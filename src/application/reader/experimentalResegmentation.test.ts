import { describe, expect, it } from "vitest";
import type { ReaderDocument } from "../../domain/processing";
import {
  resegmentReaderDocument,
  sentenceGroups,
} from "./experimentalResegmentation";

function paragraphDocument(source: string, target: string): ReaderDocument {
  return {
    segments: [
      {
        segmentId: "seg_00001",
        page: 1,
        blockType: "paragraph",
        text: source,
        extractionMethod: "native",
      },
    ],
    translations: [
      {
        segmentId: "seg_00001",
        text: target,
        reviewStatus: "needs-review",
        reviewWarnings: ["fixture warning"],
      },
    ],
    alignments: [
      {
        alignmentId: "al_seg_00001",
        sourceSegmentIds: ["seg_00001"],
        targetSegmentIds: ["seg_00001"],
        type: "1:1",
        method: "generated-id",
      },
    ],
  };
}

function normalized(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

describe("experimental sentence-group resegmentation", () => {
  it("keeps abbreviations inside their sentence", () => {
    const first =
      "Dr. Smith presented the first result in Washington, adding enough detail for this sentence to form its own group.";
    const second =
      "The second result followed immediately and includes enough context to remain a separate synchronization group.";
    expect(sentenceGroups(`${first} ${second}`, "en")).toEqual([first, second]);
  });

  it("creates smaller aligned units without losing normalized text", () => {
    const source = [
      "The first sentence contains enough material to stand as an independent synchronization unit.",
      "The second sentence also contains enough detail to remain independently selectable in the reader.",
      "The third sentence completes the deliberately long synthetic paragraph used by this test and remains independently selectable.",
    ].join(" ");
    const target = [
      "La primera oración contiene suficiente material para ser una unidad independiente de sincronización.",
      "La segunda oración también contiene suficiente detalle para poder seleccionarse de forma independiente.",
      "La tercera oración completa el párrafo sintético deliberadamente extenso utilizado por esta prueba y permanece seleccionable de forma independiente.",
    ].join(" ");
    const result = resegmentReaderDocument(paragraphDocument(source, target));

    expect(result.document.segments).toHaveLength(3);
    expect(result.document.translations).toHaveLength(3);
    expect(result.document.alignments).toHaveLength(3);
    expect(result.document.alignments.every(({ type }) => type === "1:1")).toBe(
      true,
    );
    expect(
      normalized(result.document.segments.map(({ text }) => text).join(" ")),
    ).toBe(normalized(source));
    expect(
      normalized(
        result.document.translations.map(({ text }) => text).join(" "),
      ),
    ).toBe(normalized(target));
    expect(result.document.segments[0].parentSegmentId).toBe("seg_00001");
    expect(result.document.translations[0].reviewStatus).toBe("needs-review");
  });

  it("creates monotonic n-to-one groups when sentence counts differ", () => {
    const source = [
      "The first source sentence is long enough to remain an individual unit for alignment testing.",
      "The second source sentence is also long enough to remain separate during experimental segmentation.",
      "The third source sentence finishes the example and creates a deliberately uneven sentence count.",
    ].join(" ");
    const target = [
      "La primera oración traducida tiene suficiente extensión para permanecer como una unidad independiente.",
      "La segunda oración traducida combina el resto del contenido para producir un conteo deliberadamente desigual.",
    ].join(" ");
    const result = resegmentReaderDocument(paragraphDocument(source, target));
    const usedSourceIds = result.document.alignments.flatMap(
      ({ sourceSegmentIds }) => sourceSegmentIds,
    );
    const usedTargetIds = result.document.alignments.flatMap(
      ({ targetSegmentIds }) => targetSegmentIds,
    );

    expect(result.document.alignments).toHaveLength(2);
    expect(result.document.alignments.map(({ type }) => type)).toContain("n:1");
    expect(new Set(usedSourceIds).size).toBe(result.document.segments.length);
    expect(new Set(usedTargetIds).size).toBe(
      result.document.translations.length,
    );
    expect(result.report.subdividedAlignmentCount).toBe(1);
  });

  it("leaves structural markers intact", () => {
    const document = paragraphDocument(
      "Figure 1. A structural marker remains whole.",
      "Figura 1. Un marcador estructural permanece completo.",
    );
    document.segments[0].blockType = "figure-marker";
    const result = resegmentReaderDocument(document);

    expect(result.document).toEqual(document);
  });
});
