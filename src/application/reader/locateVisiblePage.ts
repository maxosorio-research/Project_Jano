export type PageBounds = {
  pageNumber: number;
  top: number;
  height: number;
};

export type SourceViewerLocator = {
  pageNumber: number;
  pageOffset: number;
};

function intersectionLength(
  pageTop: number,
  pageBottom: number,
  viewportTop: number,
  viewportBottom: number,
): number {
  return Math.max(
    0,
    Math.min(pageBottom, viewportBottom) - Math.max(pageTop, viewportTop),
  );
}

export function locateVisiblePage(
  pages: PageBounds[],
  viewportTop: number,
  viewportHeight: number,
): SourceViewerLocator | null {
  if (pages.length === 0 || viewportHeight <= 0) {
    return null;
  }

  const viewportBottom = viewportTop + viewportHeight;
  const visible = pages
    .map((page) => ({
      page,
      visibleHeight: intersectionLength(
        page.top,
        page.top + page.height,
        viewportTop,
        viewportBottom,
      ),
    }))
    .sort(
      (left, right) =>
        right.visibleHeight - left.visibleHeight ||
        left.page.pageNumber - right.page.pageNumber,
    )[0];

  if (!visible || visible.visibleHeight === 0) {
    return null;
  }

  const pageOffset = Math.min(
    1,
    Math.max(0, (viewportTop - visible.page.top) / visible.page.height),
  );
  return { pageNumber: visible.page.pageNumber, pageOffset };
}
