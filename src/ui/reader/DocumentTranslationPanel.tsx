import { forwardRef, useImperativeHandle, useRef } from "react";
import type { SourceFileGateway } from "../../application/ports/SourceFileGateway";
import type { ReaderSurfaceHandle } from "../../application/reader/semanticScroll";
import type { BackgroundProcessingJob } from "../../application/pipeline/backgroundDocumentProcessing";
import type { ReaderDocument } from "../../domain/processing";
import type { DocumentSummary } from "../../domain/project";
import { JanoIcon } from "../icons/JanoIcon";
import { MarkdownReader } from "./MarkdownReader";

type DocumentTranslationPanelProps = {
  document: DocumentSummary | null;
  fileGateway: SourceFileGateway;
  locked?: boolean;
  onProcess(): void;
  onSelectionChange?(segmentIds: string[]): void;
  onUserIntent?(): void;
  onViewportChange?(): void;
  processingJob: BackgroundProcessingJob | null;
  projectedSegmentIds?: string[];
  readerDocument?: ReaderDocument | null;
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
    onSelectionChange,
    onUserIntent,
    onViewportChange,
    processingJob,
    projectedSegmentIds,
    readerDocument,
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
      return (
        <div className="translation-result">
          <div className="translation-result-toolbar">
            <span>
              {processing
                ? (progress?.message ?? "Preparando procesamiento…")
                : "Markdown traducido y alineado"}
            </span>
            <button
              className="secondary-button button-with-icon"
              disabled={processing}
              onClick={onProcess}
            >
              {!processing ? <JanoIcon name="regenerar" size={16} /> : null}
              <span>{processing ? "Procesando…" : "Regenerar traducción"}</span>
            </button>
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
