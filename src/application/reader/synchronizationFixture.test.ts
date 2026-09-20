import { describe, expect, it } from "vitest";
import fixture from "../../../tests/fixtures/synchronization/f22-sync-shape.json";
import type { Alignment } from "../../domain/processing";
import { mapSemanticPosition, type SegmentBounds } from "./semanticScroll";

function boundsFor(
  lengthKey: "sourceLength" | "targetLength",
): SegmentBounds[] {
  let cursor = 0;
  let previousPage = 0;

  return fixture.segments.map((segment) => {
    if (previousPage !== 0 && segment.page !== previousPage) cursor += 160;
    const start = cursor;
    const height = Math.max(28, Math.sqrt(segment[lengthKey]) * 11);
    cursor += height + 12;
    previousPage = segment.page;
    return { segmentId: segment.segmentId, start, end: start + height };
  });
}

const alignments = fixture.alignments as Alignment[];
const source = boundsFor("sourceLength");
const translation = boundsFor("targetLength");

describe("F22 de-identified synchronization fixture", () => {
  it("contains a complete real-document shape without academic text", () => {
    expect(fixture.contentIncluded).toBe(false);
    expect(fixture.source.pageCount).toBe(8);
    expect(fixture.segments).toHaveLength(fixture.source.segmentCount);
    expect(fixture.alignments).toHaveLength(fixture.source.alignmentCount);
    expect(fixture.source.segmentCount).toBeGreaterThan(100);
    expect(fixture.source.translationCount).toBe(fixture.source.segmentCount);
    expect(fixture.source.alignmentCount).toBe(fixture.source.segmentCount);
    expect(fixture.source.reviewStatusCounts["needs-review"]).toBe(1);
    expect(
      fixture.segments.every(
        (segment) => segment.sourceLength > 0 && segment.targetLength > 0,
      ),
    ).toBe(true);

    const serializedKeys = [
      ...JSON.stringify(fixture).matchAll(/"([^"\\]+)":/g),
    ].map((match) => match[1].toLowerCase());
    expect(serializedKeys).not.toContain("text");
    expect(serializedKeys).not.toContain("basetext");
    expect(serializedKeys).not.toContain("reviewedtext");
    expect(serializedKeys).not.toContain("sourcetext");
    expect(serializedKeys).not.toContain("targettext");
  });

  it("maps every source midpoint into its target segment", () => {
    for (const sourceSegment of source) {
      const targetSegment = translation.find(
        (candidate) => candidate.segmentId === sourceSegment.segmentId,
      );
      const mapped = mapSemanticPosition(
        alignments,
        source,
        translation,
        (sourceSegment.start + sourceSegment.end) / 2,
        "source",
      );

      expect(targetSegment).toBeDefined();
      expect(mapped).toBeGreaterThanOrEqual(targetSegment?.start ?? Infinity);
      expect(mapped).toBeLessThanOrEqual(targetSegment?.end ?? -Infinity);
    }
  });

  it("maps every target midpoint back into its source segment", () => {
    for (const targetSegment of translation) {
      const sourceSegment = source.find(
        (candidate) => candidate.segmentId === targetSegment.segmentId,
      );
      const mapped = mapSemanticPosition(
        alignments,
        translation,
        source,
        (targetSegment.start + targetSegment.end) / 2,
        "translation",
      );

      expect(sourceSegment).toBeDefined();
      expect(mapped).toBeGreaterThanOrEqual(sourceSegment?.start ?? Infinity);
      expect(mapped).toBeLessThanOrEqual(sourceSegment?.end ?? -Infinity);
    }
  });

  it("stays monotonic across the whole document in both directions", () => {
    const sourceMappings = source.map((segment) =>
      mapSemanticPosition(
        alignments,
        source,
        translation,
        (segment.start + segment.end) / 2,
        "source",
      ),
    );
    const targetMappings = translation.map((segment) =>
      mapSemanticPosition(
        alignments,
        translation,
        source,
        (segment.start + segment.end) / 2,
        "translation",
      ),
    );

    expect(sourceMappings.every((value) => value !== null)).toBe(true);
    expect(targetMappings.every((value) => value !== null)).toBe(true);
    expect(
      sourceMappings.every(
        (value, index) => index === 0 || value! >= sourceMappings[index - 1]!,
      ),
    ).toBe(true);
    expect(
      targetMappings.every(
        (value, index) => index === 0 || value! >= targetMappings[index - 1]!,
      ),
    ).toBe(true);
  });
});
