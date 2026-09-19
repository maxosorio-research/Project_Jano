import type { LocalTranslationRuntime } from "../ports/LocalTranslationRuntime";
import type { OcrEngine, OcrSession } from "../ports/OcrEngine";
import type { PdfDocumentAdapter } from "../ports/PdfDocumentAdapter";
import type { ProjectGateway } from "../ports/ProjectGateway";
import type { SourceFileGateway } from "../ports/SourceFileGateway";
import type {
  PipelineProgress,
  ReviewInputSegment,
  SourceSegment,
  TranslatedSegment,
  TranslationBatchResult,
} from "../../domain/processing";
import type { ProjectSnapshot } from "../../domain/project";
import type { AppSettings } from "../../domain/settings";
import {
  batchSegments,
  hasUsableNativeText,
  normalizePageText,
  segmentExtractedPages,
  sourceTextArtifact,
  translatedMarkdown,
  validateTranslations,
  type ExtractedPage,
} from "./textPipeline";
import {
  protectMathInSegments,
  restoreMathInTranslations,
  validateMathIntegrity,
} from "./mathProtection";
import { selectReviewedTranslations } from "./translationReview";
import {
  protectStableTokensInSegments,
  restoreStableTokens,
  annotateUnpreservedStableTokens,
  validateStableTokenIntegrity,
} from "./stableTokenProtection";
import { errorDetail, pipelineError, PipelineError } from "./pipelineError";

const MAX_MODEL_RETRIES = 5;

type ProcessPdfDocumentOptions = {
  documentId: string;
  originalRelativePath: string;
  rootPath: string;
  settings: AppSettings;
  documentAdapter: PdfDocumentAdapter;
  fileGateway: SourceFileGateway;
  ocrEngine: OcrEngine;
  projectGateway: ProjectGateway;
  translationRuntime: LocalTranslationRuntime;
  onProgress(progress: PipelineProgress): void;
};

export async function processPdfDocument({
  documentId,
  originalRelativePath,
  rootPath,
  settings,
  documentAdapter,
  fileGateway,
  ocrEngine,
  projectGateway,
  translationRuntime,
  onProgress,
}: ProcessPdfDocumentOptions): Promise<ProjectSnapshot> {
  let pdf;
  try {
    const buffer = await fileGateway.readOriginalPdf(
      rootPath,
      originalRelativePath,
    );
    pdf = await documentAdapter.load(new Uint8Array(buffer));
  } catch (caught) {
    throw pipelineError("loading", caught, "PDF_LOAD_FAILED");
  }
  const pages: ExtractedPage[] = [];
  let ocrSession: OcrSession | null = null;
  let processingFailure: unknown = null;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.pageCount; pageNumber += 1) {
      onProgress({
        stage: "extracting",
        current: pageNumber,
        total: pdf.pageCount,
        message: `Extrayendo texto de la página ${pageNumber} de ${pdf.pageCount}`,
      });
      let nativeSource = "";
      try {
        nativeSource = await pdf.extractPageText(pageNumber);
      } catch (caught) {
        if (settings.ocrPolicy === "never") {
          throw pipelineError("extracting", caught, "TEXT_EXTRACTION_FAILED");
        }
        onProgress({
          stage: "extracting",
          current: pageNumber,
          total: pdf.pageCount,
          message: `La capa de texto de la página ${pageNumber} falló; se intentará OCR local.`,
        });
      }
      const nativeText = normalizePageText(nativeSource);
      let visuals: ExtractedPage["visuals"];
      if (pdf.inspectPageVisuals) {
        try {
          visuals = await pdf.inspectPageVisuals(pageNumber);
        } catch {
          // Visual inspection is an enhancement. Text extraction remains usable
          // when a malformed PDF operator list cannot be inspected.
        }
      }
      if (hasUsableNativeText(nativeText)) {
        pages.push({
          page: pageNumber,
          text: nativeSource,
          method: "native",
          visuals,
        });
        continue;
      }
      if (settings.ocrPolicy === "never") {
        if (nativeText)
          pages.push({
            page: pageNumber,
            text: nativeSource,
            method: "native",
            visuals,
          });
        continue;
      }
      if (!ocrSession) {
        onProgress({
          stage: "ocr",
          current: 0,
          total: pdf.pageCount,
          message: "Preparando OCR local en inglés…",
        });
        try {
          ocrSession = await ocrEngine.createEnglishSession((progress) => {
            onProgress({
              stage: "ocr",
              current: Math.round(progress * 100),
              total: 100,
              message: `Reconociendo página ${pageNumber} · ${Math.round(progress * 100)}%`,
            });
          });
        } catch (caught) {
          throw pipelineError("ocr", caught, "OCR_FAILED");
        }
      }
      let ocrSource: string;
      try {
        const image = await pdf.renderPageImage(pageNumber, 2.25);
        ocrSource = await ocrSession.recognize(image);
      } catch (caught) {
        throw pipelineError("ocr", caught, "OCR_FAILED");
      }
      const ocrText = normalizePageText(ocrSource);
      if (ocrText)
        pages.push({
          page: pageNumber,
          text: ocrSource,
          method: "ocr",
          visuals,
        });
    }
  } catch (caught) {
    processingFailure =
      caught instanceof PipelineError
        ? caught
        : pipelineError("extracting", caught, "TEXT_EXTRACTION_FAILED");
  }
  const cleanup = await Promise.allSettled([
    ocrSession?.terminate() ?? Promise.resolve(),
    pdf.destroy(),
  ]);
  const cleanupFailure = cleanup.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (processingFailure) throw processingFailure;
  if (cleanupFailure) {
    throw pipelineError("cleanup", cleanupFailure.reason, "CLEANUP_FAILED");
  }

  const segments = segmentExtractedPages(pages);
  if (!segments.length) {
    throw new Error(
      settings.ocrPolicy === "never"
        ? "No se encontró texto utilizable. Activa OCR condicional en Ajustes."
        : "No se pudo extraer texto utilizable mediante la capa nativa ni OCR.",
    );
  }
  const protectedDocument = protectMathInSegments(segments);
  const stableDocument = protectStableTokensInSegments(
    protectedDocument.segments,
  );
  const batches = batchSegments(stableDocument.segments);
  const baseTranslations: TranslatedSegment[] = [];
  for (let index = 0; index < batches.length; index += 1) {
    onProgress({
      stage: "translating",
      current: index + 1,
      total: batches.length,
      message: `Traduciendo bloque ${index + 1} de ${batches.length} con ${settings.translationModel}`,
    });
    let result: TranslationBatchResult;
    try {
      result = await translateBatchWithRecovery(
        translationRuntime,
        settings.translationModel,
        settings.targetLanguage,
        batches[index],
        (attempt, maximum) =>
          onProgress({
            stage: "translating",
            current: index + 1,
            total: batches.length,
            message: `Ollama devolvió un bloque inválido; reintento ${attempt} de ${maximum} para el bloque ${index + 1}…`,
          }),
        (source, translated) => {
          validateMathIntegrity(source, translated);
          annotateUnpreservedStableTokens(source, translated);
        },
      );
    } catch (caught) {
      throw pipelineError("translating", caught, "MODEL_OUTPUT_INVALID");
    }
    baseTranslations.push(...result.segments);
  }
  validateTranslations(stableDocument.segments, baseTranslations);
  validateMathIntegrity(stableDocument.segments, baseTranslations);

  const reviewedTranslations: TranslatedSegment[] = [];
  if (settings.reviewLevel !== "none") {
    const baseById = new Map(
      baseTranslations.map((segment) => [segment.segmentId, segment.text]),
    );
    for (let index = 0; index < batches.length; index += 1) {
      const reviewBatch = batches[index].map((segment) => ({
        segmentId: segment.segmentId,
        sourceText: segment.text,
        baseText: baseById.get(segment.segmentId) ?? "",
      }));
      onProgress({
        stage: "reviewing",
        current: index + 1,
        total: batches.length,
        message: `Revisando estilo académico ${index + 1} de ${batches.length} con ${settings.reviewModel}…`,
      });
      try {
        const result = await reviewBatchWithRecovery(
          translationRuntime,
          settings.reviewModel,
          settings.targetLanguage,
          settings.reviewLevel,
          reviewBatch,
          (attempt, maximum) =>
            onProgress({
              stage: "reviewing",
              current: index + 1,
              total: batches.length,
              message: `El revisor alteró la estructura; reintento ${attempt} de ${maximum} para el bloque ${index + 1}…`,
            }),
        );
        reviewedTranslations.push(...result.segments);
      } catch {
        onProgress({
          stage: "reviewing",
          current: index + 1,
          total: batches.length,
          message: `No se pudo revisar el bloque ${index + 1}; se conservará su traducción base.`,
        });
      }
    }
  }

  const selectedTranslations = selectReviewedTranslations(
    stableDocument.segments,
    baseTranslations,
    settings.reviewLevel === "none" ? null : reviewedTranslations,
    settings.reviewLevel,
  );
  const translations = restoreMathInTranslations(
    restoreStableTokens(selectedTranslations, stableDocument.tokens),
    protectedDocument.mathObjects,
    "plain",
  );
  const markdownTranslations = restoreMathInTranslations(
    restoreStableTokens(selectedTranslations, stableDocument.tokens),
    protectedDocument.mathObjects,
    "markdown",
  );

  onProgress({
    stage: "saving",
    current: 1,
    total: 1,
    message: "Guardando TXT, segmentos, alineación y Markdown…",
  });
  try {
    return await projectGateway.saveProcessedDocument(rootPath, documentId, {
      sourceText: sourceTextArtifact(pages),
      segments,
      translations,
      mathObjects: protectedDocument.mathObjects,
      markdown: translatedMarkdown(segments, markdownTranslations),
      metadata: {
        model: settings.translationModel,
        sourceLanguage: "en",
        targetLanguage: settings.targetLanguage,
        createdAt: new Date().toISOString(),
        nativePageCount: pages.filter((page) => page.method === "native")
          .length,
        ocrPageCount: pages.filter((page) => page.method === "ocr").length,
        reviewLevel: settings.reviewLevel,
        reviewedSegmentCount: translations.filter(
          (segment) => segment.reviewStatus === "approved",
        ).length,
        baseRetainedSegmentCount: translations.filter(
          (segment) =>
            segment.reviewStatus === "base-retained" ||
            segment.reviewStatus === "needs-review",
        ).length,
        mathObjectCount: protectedDocument.mathObjects.length,
      },
    });
  } catch (caught) {
    throw pipelineError("saving", caught, "SAVE_FAILED");
  }
}

export async function translateBatchWithRecovery(
  runtime: LocalTranslationRuntime,
  model: string,
  targetLanguage: string,
  segments: SourceSegment[],
  onRecovery: (attempt: number, maximum: number) => void = () => undefined,
  validateResult: (
    source: SourceSegment[],
    translated: TranslatedSegment[],
  ) => void = () => undefined,
): Promise<TranslationBatchResult> {
  return executeBatchWithRecovery(
    (batch) => runtime.translateSegments(model, targetLanguage, batch),
    segments,
    onRecovery,
    validateResult,
  );
}

async function reviewBatchWithRecovery(
  runtime: LocalTranslationRuntime,
  model: string,
  targetLanguage: string,
  reviewLevel: "normal" | "strict",
  segments: ReviewInputSegment[],
  onRecovery: (attempt: number, maximum: number) => void,
): Promise<TranslationBatchResult> {
  return executeBatchWithRecovery(
    (batch) =>
      runtime.reviewSegments(model, targetLanguage, reviewLevel, batch),
    segments,
    onRecovery,
    (source, translated) => {
      const baseSegments = source.map((segment) => ({
        segmentId: segment.segmentId,
        text: segment.baseText,
      }));
      validateMathIntegrity(baseSegments, translated);
      validateStableTokenIntegrity(baseSegments, translated);
    },
  );
}

async function executeBatchWithRecovery<T extends { segmentId: string }>(
  execute: (segments: T[]) => Promise<TranslationBatchResult>,
  segments: T[],
  onRecovery: (attempt: number, maximum: number) => void,
  validateResult: (source: T[], translated: TranslatedSegment[]) => void,
  retryCount = 0,
): Promise<TranslationBatchResult> {
  try {
    const result = await execute(segments);
    validateResult(segments, result.segments);
    return result;
  } catch (caught) {
    const recoveryReason = recoverableModelFailure(caught);
    if (!recoveryReason) throw caught;
    const nextRetry = retryCount + 1;

    if (recoveryReason === "server") {
      if (nextRetry <= MAX_MODEL_RETRIES) {
        onRecovery(nextRetry, MAX_MODEL_RETRIES);
        await modelRetryDelay(nextRetry);
        return executeBatchWithRecovery(
          execute,
          segments,
          onRecovery,
          validateResult,
          nextRetry,
        );
      }
      throw new Error(
        `Ollama siguió sin responder correctamente después de ${MAX_MODEL_RETRIES} reintentos: ${errorMessage(caught)}`,
        { cause: caught },
      );
    }

    if (segments.length === 1) {
      if (nextRetry <= MAX_MODEL_RETRIES) {
        onRecovery(nextRetry, MAX_MODEL_RETRIES);
        return executeBatchWithRecovery(
          execute,
          segments,
          onRecovery,
          validateResult,
          nextRetry,
        );
      }
      throw new Error(
        `Ollama no devolvió un resultado válido para un fragmento después de ${MAX_MODEL_RETRIES} reintentos: ${errorMessage(caught)}`,
        { cause: caught },
      );
    }

    onRecovery(1, MAX_MODEL_RETRIES);
    const middle = Math.ceil(segments.length / 2);
    const first = await executeBatchWithRecovery(
      execute,
      segments.slice(0, middle),
      onRecovery,
      validateResult,
    );
    const second = await executeBatchWithRecovery(
      execute,
      segments.slice(middle),
      onRecovery,
      validateResult,
    );
    return {
      segments: [...first.segments, ...second.segments],
      elapsedMs: first.elapsedMs + second.elapsedMs,
      promptTokenCount: addNullableCounts(
        first.promptTokenCount,
        second.promptTokenCount,
      ),
      outputTokenCount: addNullableCounts(
        first.outputTokenCount,
        second.outputTokenCount,
      ),
    };
  }
}

function recoverableModelFailure(caught: unknown): "output" | "server" | null {
  if (caught instanceof PipelineError) {
    if (caught.code === "MODEL_OUTPUT_INVALID") return "output";
    if (caught.code === "MODEL_SERVER_ERROR") return "server";
  }
  const message = errorDetail(caught);
  if (
    /segment identifier|invalid translation json|empty translation|marcadores matemáticos|marcadores de cifras o referencias|cifras o referencias|math placeholder|protected marker|review batch.*too large/i.test(
      message,
    )
  ) {
    return "output";
  }
  if (
    /ollama.*(?:http 5\d\d|internal server error|not responding|did not complete)|connection refused|failed to connect|timed?\s*out/i.test(
      message,
    )
  ) {
    return "server";
  }
  return null;
}

function modelRetryDelay(failedAttempt: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.min(200 * failedAttempt, 800));
  });
}

function errorMessage(caught: unknown): string {
  return errorDetail(caught);
}

function addNullableCounts(
  first: number | null,
  second: number | null,
): number | null {
  return first === null && second === null
    ? null
    : (first ?? 0) + (second ?? 0);
}
