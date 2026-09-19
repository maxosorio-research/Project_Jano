import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { LocalTranslationRuntime } from "../../application/ports/LocalTranslationRuntime";
import type { OcrEngine } from "../../application/ports/OcrEngine";
import type { PdfDocumentAdapter } from "../../application/ports/PdfDocumentAdapter";
import type { ProjectGateway } from "../../application/ports/ProjectGateway";
import type { SourceFileGateway } from "../../application/ports/SourceFileGateway";
import type { ReaderSurfaceHandle } from "../../application/reader/semanticScroll";
import { processPdfDocument } from "../../application/pipeline/processPdfDocument";
import { userFacingPipelineError } from "../../application/pipeline/pipelineError";
import type { PipelineProgress, ReaderDocument } from "../../domain/processing";
import type { DocumentSummary, ProjectSnapshot } from "../../domain/project";
import type { AppSettings } from "../../domain/settings";
import { JanoIcon } from "../icons/JanoIcon";
import { MarkdownReader } from "./MarkdownReader";

type DocumentTranslationPanelProps = {
  document: DocumentSummary | null;
  documentAdapter: PdfDocumentAdapter;
  fileGateway: SourceFileGateway;
  locked?: boolean;
  ocrEngine: OcrEngine;
  onProcessed(snapshot: ProjectSnapshot): void;
  onUserIntent?(): void;
  onViewportChange?(): void;
  projectGateway: ProjectGateway;
  readerDocument?: ReaderDocument | null;
  rootPath: string | null;
  runtime: LocalTranslationRuntime;
  settings: AppSettings;
};

export const DocumentTranslationPanel = forwardRef<
  ReaderSurfaceHandle,
  DocumentTranslationPanelProps
>(function DocumentTranslationPanel(
  {
    document,
    documentAdapter,
    fileGateway,
    locked = false,
    ocrEngine,
    onProcessed,
    onUserIntent,
    onViewportChange,
    projectGateway,
    readerDocument,
    rootPath,
    runtime,
    settings,
  }: DocumentTranslationPanelProps,
  ref,
) {
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<ReaderSurfaceHandle>(null);

  useImperativeHandle(
    ref,
    () => ({
      snapshot: () => readerRef.current?.snapshot() ?? null,
      scrollTo: (scrollTop, behavior) =>
        readerRef.current?.scrollTo(scrollTop, behavior),
    }),
    [],
  );

  async function process() {
    if (!document?.original || !rootPath) return;
    setError(null);
    try {
      const snapshot = await processPdfDocument({
        documentId: document.documentId,
        originalRelativePath: document.original.relativePath,
        rootPath,
        settings,
        documentAdapter,
        fileGateway,
        ocrEngine,
        projectGateway,
        translationRuntime: runtime,
        onProgress: setProgress,
      });
      onProcessed(snapshot);
    } catch (caught) {
      setError(userFacingPipelineError(caught));
    } finally {
      setProgress(null);
    }
  }

  if (rootPath && document?.translation) {
    if (
      document.translation.mediaType === "text/markdown" ||
      document.translation.mediaType === "text/plain"
    ) {
      return (
        <div className="translation-result">
          <div className="translation-result-toolbar">
            <span>{progress?.message ?? "Markdown traducido y alineado"}</span>
            <button
              className="secondary-button button-with-icon"
              disabled={Boolean(progress)}
              onClick={() => void process()}
            >
              {!progress ? <JanoIcon name="regenerar" size={16} /> : null}
              <span>{progress ? "Procesando…" : "Regenerar traducción"}</span>
            </button>
          </div>
          {progress ? (
            <div
              className="pipeline-progress translation-inline-progress"
              role="status"
            >
              <progress max={progress.total} value={progress.current} />
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
            onUserIntent={onUserIntent}
            onViewportChange={onViewportChange}
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
            disabled={Boolean(progress)}
            onClick={() => void process()}
          >
            {!progress ? <JanoIcon name="traducir" size={17} /> : null}
            <span>{progress ? "Procesando…" : "Extraer y traducir"}</span>
          </button>
        ) : null}
        {progress ? (
          <div className="pipeline-progress" role="status">
            <span>{progress.message}</span>
            <progress max={progress.total} value={progress.current} />
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
