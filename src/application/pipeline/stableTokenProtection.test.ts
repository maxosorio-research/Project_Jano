import { describe, expect, it } from "vitest";
import type { SourceSegment } from "../../domain/processing";
import {
  protectStableTokensInSegments,
  restoreStableTokens,
  annotateUnpreservedStableTokens,
  validateStableTokenIntegrity,
} from "./stableTokenProtection";

const source: SourceSegment[] = [
  {
    segmentId: "seg_00086",
    page: 9,
    blockType: "paragraph",
    extractionMethod: "native",
    text: "The estimate is 0.25 (2011), p < 0.05; see https://doi.org/10.1/test.",
  },
];

describe("stable token protection", () => {
  it("protects and restores numbers and references without touching math markers", () => {
    const protectedDocument = protectStableTokensInSegments([
      { ...source[0], text: `${source[0].text} ⟦MATH_INLINE_00001⟧` },
    ]);

    expect(protectedDocument.tokens.map((token) => token.source)).toEqual([
      "0.25",
      "2011",
      "0.05",
      "https://doi.org/10.1/test.",
    ]);
    expect(protectedDocument.segments[0].text).toContain("⟦MATH_INLINE_00001⟧");
    expect(protectedDocument.segments[0].text).toContain(
      "[[JANO_NUMBER_00001]]",
    );

    const translated = [
      {
        segmentId: "seg_00086",
        text: protectedDocument.segments[0].text.replace(
          "The estimate is",
          "La estimación es",
        ),
      },
    ];
    expect(() =>
      validateStableTokenIntegrity(protectedDocument.segments, translated),
    ).not.toThrow();
    expect(
      restoreStableTokens(translated, protectedDocument.tokens)[0].text,
    ).toContain("La estimación es 0.25 (2011), p < 0.05");
  });

  it("rejects a changed or missing stable marker", () => {
    const protectedDocument = protectStableTokensInSegments(source);
    expect(() =>
      validateStableTokenIntegrity(protectedDocument.segments, [
        { segmentId: "seg_00086", text: "Sin marcadores." },
      ]),
    ).toThrow("marcadores de cifras o referencias");
  });

  it("accepts and restores common delimiter variants returned by local models", () => {
    const protectedDocument = protectStableTokensInSegments(source);
    const text = protectedDocument.segments[0].text.replace(
      "[[JANO_NUMBER_00001]]",
      "[JANO_NUMBER_00001]",
    );
    const translated = [{ segmentId: source[0].segmentId, text }];

    expect(() =>
      validateStableTokenIntegrity(protectedDocument.segments, translated),
    ).not.toThrow();
    expect(
      restoreStableTokens(translated, protectedDocument.tokens)[0].text,
    ).toContain("0.25");
  });

  it("annotates a translation that loses protected values instead of rejecting it", () => {
    const protectedDocument = protectStableTokensInSegments(source);
    const translated = [
      { segmentId: source[0].segmentId, text: "La estimación." },
    ];

    annotateUnpreservedStableTokens(protectedDocument.segments, translated);

    const restored = restoreStableTokens(
      translated,
      protectedDocument.tokens,
    )[0].text;
    expect(restored).toContain(
      "⚠ **Verificar cifras o referencias con el original:**",
    );
    expect(restored).toContain("0.25");
    expect(restored).toContain("https://doi.org/10.1/test.");
  });

  it("annotates only values that the model actually lost", () => {
    const protectedDocument = protectStableTokensInSegments(source);
    const keptNumber = protectedDocument.tokens.find(
      (token) => token.source === "0.25",
    );
    const translated = [
      {
        segmentId: source[0].segmentId,
        text: `La estimación es ${keptNumber?.placeholder}.`,
      },
    ];

    annotateUnpreservedStableTokens(protectedDocument.segments, translated);

    const restored = restoreStableTokens(
      translated,
      protectedDocument.tokens,
    )[0].text;
    expect(restored.match(/0\.25/g)).toHaveLength(1);
    expect(restored).toContain("2011");
    expect(restored).toContain("https://doi.org/10.1/test.");
  });
});
