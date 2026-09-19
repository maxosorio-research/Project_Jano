import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  PdfDocumentAdapter,
  PdfDocumentHandle,
} from "../../application/ports/PdfDocumentAdapter";
import type { SourceFileGateway } from "../../application/ports/SourceFileGateway";
import type { ReaderSurfaceHandle } from "../../application/reader/semanticScroll";
import { selectedOverlappingSegmentIds } from "../../application/reader/selectionProjection";
import {
  locateVisiblePage,
  type SourceViewerLocator,
} from "../../application/reader/locateVisiblePage";
import type { SourceSegment } from "../../domain/processing";

type PdfSource = {
  rootPath: string;
  relativePath: string;
};

type PdfReaderProps = {
  source: PdfSource;
  fileGateway: SourceFileGateway;
  documentAdapter: PdfDocumentAdapter;
  initialScale?: number;
  locked?: boolean;
  onSelectionChange?(segmentIds: string[]): void;
  projectedSegmentIds?: string[];
  segments?: SourceSegment[];
  onUserIntent?(): void;
  onViewportChange?(): void;
  onViewStateChange?(state: PdfReaderViewState): void;
};

export type PdfReaderViewState = {
  pageNumber: number;
  pageCount: number;
  scale: number;
};

export interface PdfReaderHandle extends ReaderSurfaceHandle {
  previousPage(): void;
  nextPage(): void;
  zoomIn(): void;
  zoomOut(): void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.25;

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type PdfPageViewProps = {
  document: PdfDocumentHandle;
  pageNumber: number;
  scale: number;
  scrollRoot: HTMLElement | null;
  projectedSegmentIds: ReadonlySet<string>;
  segments: SourceSegment[];
  onRendered(): void;
};

type SegmentAnchor = {
  segmentId: string;
  top: number;
  height: number;
};

function layoutSegmentAnchors(segments: SourceSegment[]): SegmentAnchor[] {
  const weights = segments.map((segment) => Math.max(40, segment.text.length));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  return segments.map((segment, index) => {
    const start = total ? cursor / total : index / Math.max(1, segments.length);
    cursor += weights[index];
    const end = total
      ? cursor / total
      : (index + 1) / Math.max(1, segments.length);
    return {
      segmentId: segment.segmentId,
      top: start * 100,
      height: Math.max(0.5, (end - start) * 100),
    };
  });
}

function PdfPageView({
  document,
  pageNumber,
  scale,
  scrollRoot,
  projectedSegmentIds,
  segments,
  onRendered,
}: PdfPageViewProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(pageNumber <= 2);
  const [error, setError] = useState<string | null>(null);
  const anchors = useMemo(() => layoutSegmentAnchors(segments), [segments]);

  useEffect(() => {
    if (shouldRender || !pageRef.current || !scrollRoot) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { root: scrollRoot, rootMargin: "900px 0px" },
    );
    observer.observe(pageRef.current);
    return () => observer.disconnect();
  }, [scrollRoot, shouldRender]);

  useEffect(() => {
    if (
      !shouldRender ||
      !pageRef.current ||
      !canvasRef.current ||
      !textLayerRef.current
    ) {
      return;
    }
    const job = document.renderPage(
      pageNumber,
      scale,
      pageRef.current,
      canvasRef.current,
      textLayerRef.current,
    );
    let active = true;
    void job.finished
      .then(() => {
        if (active) {
          setError(null);
          onRendered();
        }
      })
      .catch((caught) => {
        if (active) {
          setError(messageFrom(caught));
        }
      });
    return () => {
      active = false;
      job.cancel();
    };
  }, [document, onRendered, pageNumber, scale, shouldRender]);

  return (
    <section
      aria-label={`PDF page ${pageNumber}`}
      className="pdf-page-frame"
      data-page-number={pageNumber}
      ref={pageRef}
      style={{
        width: `${612 * scale}px`,
        height: `${792 * scale}px`,
      }}
    >
      <div aria-hidden="true" className="pdf-semantic-anchors">
        {anchors.map((anchor) => (
          <span
            className={`pdf-semantic-anchor ${
              projectedSegmentIds.has(anchor.segmentId)
                ? "projected-counterpart"
                : ""
            }`}
            data-segment-id={anchor.segmentId}
            key={anchor.segmentId}
            style={{ top: `${anchor.top}%`, height: `${anchor.height}%` }}
          />
        ))}
      </div>
      {shouldRender ? (
        <>
          <canvas aria-hidden="true" ref={canvasRef} />
          <div className="textLayer" ref={textLayerRef} />
          {error ? (
            <p className="pdf-page-error">
              Page {pageNumber}: {error}
            </p>
          ) : null}
        </>
      ) : (
        <span className="pdf-page-number">{pageNumber}</span>
      )}
    </section>
  );
}

export const PdfReader = forwardRef<PdfReaderHandle, PdfReaderProps>(
  function PdfReader(
    {
      source,
      fileGateway,
      documentAdapter,
      initialScale = 1,
      locked = false,
      onSelectionChange,
      projectedSegmentIds = [],
      segments = [],
      onUserIntent,
      onViewportChange,
      onViewStateChange,
    },
    ref,
  ) {
    const [document, setDocument] = useState<PdfDocumentHandle | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [scale, setScale] = useState(initialScale);
    const [locator, setLocator] = useState<SourceViewerLocator>({
      pageNumber: 1,
      pageOffset: 0,
    });
    const scrollRef = useRef<HTMLDivElement>(null);
    const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
    const frameRequest = useRef<number | null>(null);
    const projectedSegments = useMemo(
      () => new Set(projectedSegmentIds),
      [projectedSegmentIds],
    );
    const segmentsByPage = useMemo(() => {
      const result = new Map<number, SourceSegment[]>();
      for (const segment of segments) {
        const pageSegments = result.get(segment.page) ?? [];
        pageSegments.push(segment);
        result.set(segment.page, pageSegments);
      }
      return result;
    }, [segments]);

    const assignScrollRoot = useCallback((element: HTMLDivElement | null) => {
      scrollRef.current = element;
      setScrollRoot(element);
    }, []);

    const updateLocator = useCallback(() => {
      const scrollRoot = scrollRef.current;
      if (!scrollRoot) {
        return;
      }
      const pages = Array.from(
        scrollRoot.querySelectorAll<HTMLElement>(".pdf-page-frame"),
        (element) => ({
          pageNumber: Number(element.dataset.pageNumber),
          top: element.offsetTop,
          height: element.offsetHeight,
        }),
      );
      const next = locateVisiblePage(
        pages,
        scrollRoot.scrollTop,
        scrollRoot.clientHeight,
      );
      if (next) {
        setLocator((current) =>
          current.pageNumber === next.pageNumber &&
          Math.abs(current.pageOffset - next.pageOffset) < 0.01
            ? current
            : next,
        );
      }
    }, []);

    const scheduleLocatorUpdate = useCallback(() => {
      if (frameRequest.current !== null) {
        return;
      }
      frameRequest.current = requestAnimationFrame(() => {
        frameRequest.current = null;
        updateLocator();
        onViewportChange?.();
      });
    }, [onViewportChange, updateLocator]);

    const reportSelection = useCallback(() => {
      const root = scrollRef.current;
      onSelectionChange?.(
        root ? selectedOverlappingSegmentIds(root, ".pdf-semantic-anchor") : [],
      );
    }, [onSelectionChange]);

    useEffect(() => {
      let active = true;
      let loadedDocument: PdfDocumentHandle | null = null;
      void fileGateway
        .readOriginalPdf(source.rootPath, source.relativePath)
        .then((buffer) => documentAdapter.load(new Uint8Array(buffer)))
        .then((nextDocument) => {
          loadedDocument = nextDocument;
          if (active) {
            setDocument(nextDocument);
          } else {
            void nextDocument.destroy();
          }
        })
        .catch((caught) => {
          if (active) {
            setError(messageFrom(caught));
          }
        });
      return () => {
        active = false;
        if (frameRequest.current !== null) {
          cancelAnimationFrame(frameRequest.current);
        }
        if (loadedDocument) {
          void loadedDocument.destroy();
        }
      };
    }, [documentAdapter, fileGateway, source.relativePath, source.rootPath]);

    function changeScale(delta: number) {
      setScale((current) =>
        Math.min(MAX_SCALE, Math.max(MIN_SCALE, current + delta)),
      );
    }

    const goToPage = useCallback(
      (pageNumber: number) => {
        if (locked) return;
        const root = scrollRef.current;
        const frame = root?.querySelector<HTMLElement>(
          `.pdf-page-frame[data-page-number="${pageNumber}"]`,
        );
        if (!root || !frame) return;
        onUserIntent?.();
        root.scrollTo({ top: frame.offsetTop, behavior: "smooth" });
      },
      [locked, onUserIntent],
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
              root.querySelectorAll<HTMLElement>(".pdf-semantic-anchor"),
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
          if (!locked)
            scrollRef.current?.scrollTo({ top: scrollTop, behavior });
        },
        previousPage() {
          goToPage(Math.max(1, locator.pageNumber - 1));
        },
        nextPage() {
          goToPage(Math.min(document?.pageCount ?? 1, locator.pageNumber + 1));
        },
        zoomIn() {
          if (!locked) changeScale(SCALE_STEP);
        },
        zoomOut() {
          if (!locked) changeScale(-SCALE_STEP);
        },
      }),
      [document?.pageCount, goToPage, locator.pageNumber, locked],
    );

    useEffect(() => {
      if (!document) return;
      onViewStateChange?.({
        pageNumber: locator.pageNumber,
        pageCount: document.pageCount,
        scale,
      });
    }, [document, locator.pageNumber, onViewStateChange, scale]);

    if (error) {
      return (
        <div className="pdf-reader-message" role="alert">
          <strong>Could not open the original PDF.</strong>
          <span>{error}</span>
        </div>
      );
    }

    if (!document) {
      return (
        <div className="pdf-reader-message" role="status">
          <strong>Opening PDF…</strong>
          <span>{source.relativePath}</span>
        </div>
      );
    }

    return (
      <div className="pdf-reader">
        <div
          aria-label={locked ? "Original bloqueado" : "Lectura del original"}
          className={`pdf-scroll-view ${locked ? "reader-scroll-locked" : ""}`}
          onKeyDown={onUserIntent}
          onKeyUp={reportSelection}
          onPointerDown={onUserIntent}
          onPointerUp={reportSelection}
          onScroll={scheduleLocatorUpdate}
          onTouchStart={onUserIntent}
          onWheel={onUserIntent}
          ref={assignScrollRoot}
          tabIndex={0}
        >
          <div className="pdf-page-flow">
            {Array.from({ length: document.pageCount }, (_, index) => (
              <PdfPageView
                document={document}
                key={index + 1}
                onRendered={scheduleLocatorUpdate}
                pageNumber={index + 1}
                projectedSegmentIds={projectedSegments}
                scale={scale}
                segments={segmentsByPage.get(index + 1) ?? []}
                scrollRoot={scrollRoot}
              />
            ))}
          </div>
        </div>
      </div>
    );
  },
);
