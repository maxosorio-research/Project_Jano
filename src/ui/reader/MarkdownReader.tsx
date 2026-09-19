import {
  Component,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import type { SourceFileGateway } from "../../application/ports/SourceFileGateway";
import type { ReaderSurfaceHandle } from "../../application/reader/semanticScroll";
import { selectedDomSegmentIds } from "../../application/reader/selectionProjection";
import {
  pageMarker,
  stripReaderMetadata,
} from "../../application/pipeline/textPipeline";
import type { ReaderDocument, SourceSegment } from "../../domain/processing";
import { translationPageBoundary } from "./translationPageBoundary";

type MarkdownReaderProps = {
  fileGateway: SourceFileGateway;
  relativePath: string;
  rootPath: string;
  readerDocument?: ReaderDocument | null;
  locked?: boolean;
  onSelectionChange?(segmentIds: string[]): void;
  onUserIntent?(): void;
  onViewportChange?(): void;
  projectedSegmentIds?: string[];
};

function markdownForSegment(source: SourceSegment | undefined, text: string) {
  if (source?.blockType === "heading") return `## ${text}`;
  if (source?.blockType === "figure-marker") {
    return `> **Figura o gráfica en el original · página ${source.page}.**\n>\n> ${text}`;
  }
  if (source?.blockType === "table-marker") {
    return `> **Tabla en el original · página ${source.page}.**\n>\n> ${text}`;
  }
  return text;
}

export const MarkdownReader = forwardRef<
  ReaderSurfaceHandle,
  MarkdownReaderProps
>(function MarkdownReader(
  {
    fileGateway,
    relativePath,
    rootPath,
    readerDocument,
    locked = false,
    onSelectionChange,
    onUserIntent,
    onViewportChange,
    projectedSegmentIds = [],
  },
  ref,
) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRequest = useRef<number | null>(null);
  const projectedSegments = useMemo(
    () => new Set(projectedSegmentIds),
    [projectedSegmentIds],
  );
  const sourceById = useMemo(
    () =>
      new Map(
        (readerDocument?.segments ?? []).map((segment) => [
          segment.segmentId,
          segment,
        ]),
      ),
    [readerDocument],
  );

  useEffect(() => {
    if (readerDocument) return;
    let active = true;
    void fileGateway
      .readTranslationText(rootPath, relativePath)
      .then((text) => {
        if (active) setMarkdown(text);
      })
      .catch((caught: unknown) => {
        if (active)
          setError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => {
      active = false;
    };
  }, [fileGateway, readerDocument, relativePath, rootPath]);

  useEffect(
    () => () => {
      if (frameRequest.current !== null) {
        cancelAnimationFrame(frameRequest.current);
      }
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      snapshot() {
        const root = scrollRef.current;
        if (!root) return null;
        const rootRect = root.getBoundingClientRect();
        return {
          scrollTop: root.scrollTop,
          viewportHeight: root.clientHeight,
          scrollHeight: root.scrollHeight,
          segments: Array.from(
            root.querySelectorAll<HTMLElement>(".translation-segment"),
            (element) => {
              const rect = element.getBoundingClientRect();
              const start = rect.top - rootRect.top + root.scrollTop;
              return {
                segmentId: element.dataset.segmentId ?? "",
                start,
                end: start + Math.max(1, rect.height),
              };
            },
          ).filter((item) => item.segmentId !== ""),
        };
      },
      scrollTo(scrollTop, behavior = "auto") {
        if (!locked) scrollRef.current?.scrollTo({ top: scrollTop, behavior });
      },
    }),
    [locked],
  );

  function scheduleViewportChange() {
    if (frameRequest.current !== null) return;
    frameRequest.current = requestAnimationFrame(() => {
      frameRequest.current = null;
      onViewportChange?.();
    });
  }

  const reportSelection = useCallback(() => {
    const root = scrollRef.current;
    onSelectionChange?.(
      root ? selectedDomSegmentIds(root, ".translation-segment") : [],
    );
  }, [onSelectionChange]);

  if (error) {
    return <div className="translation-message error-message">{error}</div>;
  }
  if (!readerDocument && markdown === null) {
    return <div className="translation-message">Abriendo traducción…</div>;
  }
  const visibleMarkdown = stripReaderMetadata(markdown ?? "");
  const boundaryMarkdown =
    readerDocument?.translations.map((segment) => segment.text).join("\n\n") ??
    visibleMarkdown;
  return (
    <div
      aria-label={locked ? "Traducción bloqueada" : "Lectura de la traducción"}
      className={`translation-scroll-view ${locked ? "reader-scroll-locked" : ""}`}
      onKeyDown={onUserIntent}
      onKeyUp={reportSelection}
      onPointerDown={onUserIntent}
      onPointerUp={reportSelection}
      onScroll={scheduleViewportChange}
      onTouchStart={onUserIntent}
      onWheel={onUserIntent}
      ref={scrollRef}
      tabIndex={0}
    >
      <MarkdownRenderBoundary markdown={boundaryMarkdown}>
        <article className="markdown-reader">
          {readerDocument ? (
            readerDocument.translations.map((translation, index) => {
              const source = sourceById.get(translation.segmentId);
              const previousTranslation =
                readerDocument.translations[index - 1];
              const previousSource = previousTranslation
                ? sourceById.get(previousTranslation.segmentId)
                : undefined;
              const pageBoundary = translationPageBoundary(
                source,
                previousSource,
              );
              return (
                <section
                  className={`translation-segment ${
                    projectedSegments.has(translation.segmentId)
                      ? "projected-counterpart"
                      : ""
                  }`}
                  data-segment-id={translation.segmentId}
                  key={translation.segmentId}
                >
                  {pageBoundary !== null ? (
                    <div
                      aria-label={`Inicio de la página ${pageBoundary} del original`}
                      className="translation-page-marker"
                      role="separator"
                    >
                      {pageMarker(pageBoundary)}
                    </div>
                  ) : null}
                  <MarkdownContent>
                    {markdownForSegment(source, translation.text)}
                  </MarkdownContent>
                </section>
              );
            })
          ) : (
            <MarkdownContent>{visibleMarkdown}</MarkdownContent>
          )}
        </article>
      </MarkdownRenderBoundary>
    </div>
  );
});

function MarkdownContent({ children }: { children: string }) {
  return (
    <ReactMarkdown
      rehypePlugins={[
        [
          rehypeKatex,
          {
            output: "htmlAndMathml",
            strict: "ignore",
            throwOnError: false,
          },
        ],
      ]}
      remarkPlugins={[remarkMath]}
    >
      {children}
    </ReactMarkdown>
  );
}

class MarkdownRenderBoundary extends Component<
  { children: ReactNode; markdown: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: Readonly<{ markdown: string }>) {
    if (previous.markdown !== this.props.markdown && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <article className="markdown-reader markdown-fallback" role="alert">
          <p>
            Una fórmula o estructura Markdown no pudo representarse. Se muestra
            el texto fiel para no ocultar contenido.
          </p>
          <pre>{this.props.markdown}</pre>
        </article>
      );
    }
    return this.props.children;
  }
}
