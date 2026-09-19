import { describe, expect, it } from "vitest";
import {
  batchSegments,
  hasUsableNativeText,
  normalizePageText,
  segmentExtractedPages,
  stripReaderMetadata,
  translatedMarkdown,
  validateStableTokens,
  validateTranslations,
} from "./textPipeline";

describe("text pipeline", () => {
  it("rejects empty or corrupt native text and accepts academic prose", () => {
    expect(hasUsableNativeText("scan")).toBe(false);
    expect(hasUsableNativeText("�".repeat(200))).toBe(false);
    expect(
      hasUsableNativeText(
        "Political institutions shape incentives and constrain strategic behavior across democratic systems. This paragraph contains enough coherent words to represent a usable native PDF text layer.",
      ),
    ).toBe(true);
  });

  it("normalizes wrapped and hyphenated PDF lines", () => {
    expect(
      normalizePageText(
        "Political institu-\ntions matter.\nThey persist.\n\n2 Methods",
      ),
    ).toBe("Political institutions matter. They persist.\n\n2 Methods");
  });

  it("creates stable page-aware segments and contextual batches", () => {
    const segments = segmentExtractedPages([
      { page: 1, method: "native", text: "Introduction\n\nFirst paragraph." },
      { page: 2, method: "ocr", text: "Second paragraph." },
    ]);
    expect(segments.map((segment) => segment.segmentId)).toEqual([
      "seg_00001",
      "seg_00002",
      "seg_00003",
    ]);
    expect(segments[2]).toMatchObject({ page: 2, extractionMethod: "ocr" });
    expect(batchSegments(segments)).toHaveLength(1);
  });

  it("classifies equations, figure captions and table captions from PDF lines", () => {
    const segments = segmentExtractedPages([
      {
        page: 7,
        method: "native",
        text: [
          "A short introduction to the model.",
          "",
          "Γr(Y) = ∑ YijYji. (2)",
          "",
          "Fig. 1 The uniform distribution over a three-node directed network.",
          "",
          "Table 1: ERGM fit for the conflict network.",
        ].join("\n"),
      },
    ]);

    expect(segments.map((segment) => segment.blockType)).toEqual([
      "paragraph",
      "equation-marker",
      "figure-marker",
      "table-marker",
    ]);
    const markdown = translatedMarkdown(
      segments,
      segments.map((segment) => ({
        segmentId: segment.segmentId,
        text: segment.text,
      })),
    );
    expect(markdown).toContain("Figura o gráfica en el original · página 7");
    expect(markdown).toContain("Tabla en el original · página 7");
  });

  it("adds a conservative original-page marker for an uncaptioned vector chart", () => {
    const segments = segmentExtractedPages([
      {
        page: 25,
        method: "native",
        text: "Somewhat close trend\nVery close trend\nDiagonal",
        visuals: { imageCount: 0, vectorPathCount: 110 },
      },
    ]);

    expect(segments.at(-1)).toMatchObject({
      page: 25,
      blockType: "figure-marker",
      text: "Visual content detected in the original document.",
    });
  });

  it("validates IDs before generating Markdown", () => {
    const source = segmentExtractedPages([
      {
        page: 1,
        method: "native",
        text: "Introduction\n\nA complete paragraph.",
      },
    ]);
    const translations = source.map((segment) => ({
      segmentId: segment.segmentId,
      text:
        segment.blockType === "heading"
          ? "Introducción"
          : "Un párrafo completo.",
    }));
    expect(() => validateTranslations(source, translations)).not.toThrow();
    expect(translatedMarkdown(source, translations)).toContain(
      "## Introducción",
    );
    expect(translatedMarkdown(source, translations)).not.toContain("seg_00001");
    expect(() => validateTranslations(source, translations.slice(1))).toThrow();
  });

  it("hides legacy segment metadata from the reading surface", () => {
    expect(
      stripReaderMetadata(
        "<!-- seg_00007 · página 1 -->\nTexto traducido.\n\n<!-- seg_00008 · página 2 -->\nMás texto.",
      ),
    ).toBe("\nTexto traducido.\n\nMás texto.");
  });

  it("rejects changed figures and references", () => {
    const source = [
      {
        segmentId: "seg_00001",
        text: "The estimate is 0.25 (2011); see https://doi.org/10.1/test.",
      },
    ];
    expect(() =>
      validateStableTokens(source, [
        {
          segmentId: "seg_00001",
          text: "La estimación es 0.25 (2011); véase https://doi.org/10.1/test.",
        },
      ]),
    ).not.toThrow();
    expect(() =>
      validateStableTokens(source, [
        {
          segmentId: "seg_00001",
          text: "La estimación es 0.35 (2011).",
        },
      ]),
    ).toThrow("cifras o referencias");
  });
});
