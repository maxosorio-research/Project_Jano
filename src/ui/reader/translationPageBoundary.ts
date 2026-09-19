import type { SourceSegment } from "../../domain/processing";

export function translationPageBoundary(
  current: SourceSegment | undefined,
  previous: SourceSegment | undefined,
): number | null {
  if (!current || current.page === previous?.page) return null;
  return current.page;
}

export function translationFootnoteBoundary(
  current: SourceSegment | undefined,
  previous: SourceSegment | undefined,
): boolean {
  return Boolean(
    current?.blockType === "footnote" &&
    (previous?.blockType !== "footnote" || previous.page !== current.page),
  );
}
