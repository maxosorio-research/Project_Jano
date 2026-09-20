import { describe, expect, it } from "vitest";
import fixture from "../../../tests/fixtures/synchronization/f22-sync-shape.json";
import type {
  Alignment,
  ReaderDocument,
  SourceSegment,
  TranslatedSegment,
} from "../../domain/processing";
import { resegmentReaderDocument } from "./experimentalResegmentation";
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

function shapedSentence(length: number, index: number): string {
  const prefix = `Unit ${index + 1} `;
  return `${prefix}${"x".repeat(Math.max(1, length - prefix.length - 1))}.`;
}

function shapedText(lengths: number[]): string {
  return lengths.map(shapedSentence).join(" ");
}

function readerDocumentFromFixture(): ReaderDocument {
  return {
    segments: fixture.segments.map<SourceSegment>((segment) => ({
      segmentId: segment.segmentId,
      page: segment.page,
      blockType: segment.blockType as SourceSegment["blockType"],
      text: shapedText(segment.sourceSentenceLengths),
      extractionMethod: "native",
    })),
    translations: fixture.segments.map<TranslatedSegment>((segment) => ({
      segmentId: segment.segmentId,
      text: shapedText(segment.targetSentenceLengths),
      reviewStatus: segment.reviewStatus as TranslatedSegment["reviewStatus"],
    })),
    alignments,
  };
}

function syntheticBounds(
  segments: Array<{ segmentId: string; text: string }>,
): SegmentBounds[] {
  let cursor = 0;
  return segments.map((segment) => {
    const start = cursor;
    const height = Math.max(28, Math.sqrt(segment.text.length) * 11);
    cursor += height + 12;
    return { segmentId: segment.segmentId, start, end: start + height };
  });
}

describe("F22 de-identified synchronization fixture", () => {
  it("contains a complete real-document shape without academic text", () => {
    expect(fixture.schemaVersion).toBe(2);
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
        (segment) =>
          segment.sourceLength > 0 &&
          segment.targetLength > 0 &&
          segment.sourceSentenceLengths.length > 0 &&
          segment.targetSentenceLengths.length > 0,
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

  it("resegments the real F22 sentence shape without gaps or reverse jumps", () => {
    const result = resegmentReaderDocument(readerDocumentFromFixture());
    const resegmentedSource = syntheticBounds(result.document.segments);
    const resegmentedTarget = syntheticBounds(result.document.translations);
    const usedSourceIds = result.document.alignments.flatMap(
      ({ sourceSegmentIds }) => sourceSegmentIds,
    );
    const usedTargetIds = result.document.alignments.flatMap(
      ({ targetSegmentIds }) => targetSegmentIds,
    );

    expect(result.document.segments.length).toBeGreaterThan(
      fixture.source.segmentCount,
    );
    expect(result.document.translations.length).toBeGreaterThan(
      fixture.source.translationCount,
    );
    expect(new Set(usedSourceIds).size).toBe(result.document.segments.length);
    expect(new Set(usedTargetIds).size).toBe(
      result.document.translations.length,
    );
    expect(usedSourceIds).toHaveLength(result.document.segments.length);
    expect(usedTargetIds).toHaveLength(result.document.translations.length);

    for (const [from, to, side] of [
      [resegmentedSource, resegmentedTarget, "source"],
      [resegmentedTarget, resegmentedSource, "translation"],
    ] as const) {
      const mappings = from.map((segment) =>
        mapSemanticPosition(
          result.document.alignments,
          from,
          to,
          (segment.start + segment.end) / 2,
          side,
        ),
      );
      expect(mappings.every((value) => value !== null)).toBe(true);
      expect(
        mappings.every(
          (value, index) => index === 0 || value! >= mappings[index - 1]!,
        ),
      ).toBe(true);
    }
  });
});
