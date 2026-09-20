import { forwardRef, useImperativeHandle, useRef } from "react";
import type { SourceFileGateway } from "../../application/ports/SourceFileGateway";
import type { ReaderSurfaceHandle } from "../../application/reader/semanticScroll";
import type { BackgroundProcessingJob } from "../../application/pipeline/backgroundDocumentProcessing";
import type { ExperimentalResegmentationReport } from "../../application/reader/experimentalResegmentation";
import type { ReaderDocument } from "../../domain/processing";
import type { DocumentSummary } from "../../domain/project";
import { JanoIcon } from "../icons/JanoIcon";
import { MarkdownReader } from "./MarkdownReader";

type DocumentTranslationPanelProps = {
  document: DocumentSummary | null;
  fileGateway: SourceFileGateway;
  locked?: boolean;
  onProcess(): void;
  onToggleExperimentalResegmentation(): void;
  onSelectionChange?(segmentIds: string[]): void;
  onUserIntent?(): void;
  onViewportChange?(): void;
  processingJob: BackgroundProcessingJob | null;
  projectedSegmentIds?: string[];
  readerDocument?: ReaderDocument | null;
  readerDocumentLoaded?: boolean;
  resegmentationReport?: ExperimentalResegmentationReport | null;
  rootPath: string | null;
};

export const DocumentTranslationPanel = forwardRef<
  ReaderSurfaceHandle,
  DocumentTranslationPanelProps
>(function DocumentTranslationPanel(
  {
    document,
    fileGateway,
    locked = false,
    onProcess,
    onToggleExperimentalResegmentation,
    onSelectionChange,
    onUserIntent,
    onViewportChange,
    processingJob,
    projectedSegmentIds,
    readerDocument,
    readerDocumentLoaded = false,
    resegmentationReport = null,
    rootPath,
  }: DocumentTranslationPanelProps,
  ref,
) {
  const readerRef = useRef<ReaderSurfaceHandle>(null);
  const processing = processingJob?.phase === "running";
  const progress = processing ? processingJob.progress : null;
  const error = processingJob?.phase === "failed" ? processingJob.error : null;

  useImperativeHandle(
    ref,
    () => ({
      snapshot: () => readerRef.current?.snapshot() ?? null,
      scrollTo: (scrollTop, behavior) =>
        readerRef.current?.scrollTo(scrollTop, behavior),
    }),
    [],
  );

  if (rootPath && document?.translation) {
    if (
      document.translation.mediaType === "text/markdown" ||
      document.translation.mediaType === "text/plain"
    ) {
      if (!readerDocument) {
        return (
          <div className="panel-placeholder">
            <p className="file-path">{document.translation.relativePath}</p>
            <span>
              {readerDocumentLoaded
                ? "Traducción externa o sin representación estructurada. Jano 0.1 solo sincroniza traducciones generadas por su pipeline local."
                : "Cargando traducción estructurada…"}
            </span>
          </div>
        );
      }
      return (
        <div className="translation-result">
          <div className="translation-result-toolbar">
            <span className="translation-result-status">
              {processing
                ? (progress?.message ?? "Preparando procesamiento…")
                : resegmentationReport
                  ? `Prueba temporal · fuente ${resegmentationReport.originalSourceSegmentCount}→${resegmentationReport.sourceSegmentCount} · traducción ${resegmentationReport.originalTargetSegmentCount}→${resegmentationReport.targetSegmentCount} · sin guardar`
                  : "Traducción Jano alineada"}
            </span>
            <div className="translation-result-actions">
              <button
                aria-pressed={Boolean(resegmentationReport)}
                className={`secondary-button button-with-icon ${
                  resegmentationReport ? "experimental-button-active" : ""
                }`}
                disabled={processing}
                onClick={onToggleExperimentalResegmentation}
                title={
                  resegmentationReport
                    ? "Volver a los segmentos persistidos"
                    : "Probar unidades de oración en memoria sin modificar archivos"
                }
                type="button"
              >
                <JanoIcon name="segmento" size={16} />
                <span>
                  {resegmentationReport
                    ? "Restaurar segmentos"
                    : "Resegmentar (prueba)"}
                </span>
              </button>
              <button
                className="secondary-button button-with-icon"
                disabled={processing}
                onClick={onProcess}
                type="button"
              >
                {!processing ? <JanoIcon name="regenerar" size={16} /> : null}
                <span>
                  {processing ? "Procesando…" : "Regenerar traducción"}
                </span>
              </button>
            </div>
          </div>
          {processing ? (
            <div
              className="pipeline-progress translation-inline-progress"
              role="status"
            >
              <progress
                max={progress?.total ?? 1}
                value={progress?.current ?? 0}
              />
            </div>
          ) : null}
          {error ? (
            <p className="error-message compact-error" role="alert">
              {error}
            </p>
          ) : null}
          <MarkdownReader
            fileGateway={fileGateway}
            key={`${document.translation.relativePath}:${document.translation.sha256}`}
            locked={locked}
            onSelectionChange={onSelectionChange}
            onUserIntent={onUserIntent}
            onViewportChange={onViewportChange}
            projectedSegmentIds={projectedSegmentIds}
            readerDocument={readerDocument}
            ref={readerRef}
            relativePath={document.translation.relativePath}
            rootPath={rootPath}
          />
        </div>
      );
    }
    return (
      <div className="panel-placeholder">
        <p className="file-path">{document.translation.relativePath}</p>
        <span>
          La normalización de traducciones PDF externas se incorporará después.
        </span>
      </div>
    );
  }

  return (
    <div className="translation-empty-state">
      <div>
        <p>
          {document
            ? "Este documento todavía no tiene traducción."
            : rootPath
              ? "Selecciona un documento"
              : "Abre un proyecto"}
        </p>
        {document?.original ? (
          <button
            className="primary-button button-with-icon"
            disabled={processing}
            onClick={onProcess}
          >
            {!processing ? <JanoIcon name="traducir" size={17} /> : null}
            <span>{processing ? "Procesando…" : "Extraer y traducir"}</span>
          </button>
        ) : null}
        {processing ? (
          <div className="pipeline-progress" role="status">
            <span>{progress?.message ?? "Preparando procesamiento…"}</span>
            <progress
              max={progress?.total ?? 1}
              value={progress?.current ?? 0}
            />
          </div>
        ) : null}
        {error ? (
          <p className="error-message compact-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
});
