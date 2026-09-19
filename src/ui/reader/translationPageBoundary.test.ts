import { describe, expect, it } from "vitest";
import type { SourceSegment } from "../../domain/processing";
import {
  translationFootnoteBoundary,
  translationPageBoundary,
} from "./translationPageBoundary";

function segment(
  page: number,
  blockType: SourceSegment["blockType"] = "paragraph",
): SourceSegment {
  return {
    segmentId: `segment-${page}`,
    page,
    blockType,
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

  it("marks only the start of each page's footnote group", () => {
    expect(
      translationFootnoteBoundary(segment(1, "footnote"), segment(1)),
    ).toBe(true);
    expect(
      translationFootnoteBoundary(
        segment(1, "footnote"),
        segment(1, "footnote"),
      ),
    ).toBe(false);
    expect(
      translationFootnoteBoundary(
        segment(2, "footnote"),
        segment(1, "footnote"),
      ),
    ).toBe(true);
  });

  it("does not invent a marker when source location is unavailable", () => {
    expect(translationPageBoundary(undefined, segment(1))).toBeNull();
  });
});
