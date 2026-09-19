import { describe, expect, it } from "vitest";
import type { SourceSegment } from "../../domain/processing";
import { translationPageBoundary } from "./translationPageBoundary";

function segment(page: number): SourceSegment {
  return {
    segmentId: `segment-${page}`,
    page,
    blockType: "paragraph",
    text: "Text",
    extractionMethod: "native",
  };
}

describe("translation page boundaries", () => {
  it("marks the first translated segment and each page change", () => {
    expect(translationPageBoundary(segment(1), undefined)).toBe(1);
    expect(translationPageBoundary(segment(1), segment(1))).toBeNull();
    expect(translationPageBoundary(segment(2), segment(1))).toBe(2);
  });

  it("does not invent a marker when source location is unavailable", () => {
    expect(translationPageBoundary(undefined, segment(1))).toBeNull();
  });
});
