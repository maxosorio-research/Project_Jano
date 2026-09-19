import type { SourceSegment } from "../../domain/processing";

export function translationPageBoundary(
  current: SourceSegment | undefined,
  previous: SourceSegment | undefined,
): number | null {
  if (!current || current.page === previous?.page) return null;
  return current.page;
}
