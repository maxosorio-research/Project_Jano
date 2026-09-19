import { describe, expect, it } from "vitest";
import type { SourceSegment } from "../../domain/processing";
import { selectReviewedTranslations } from "./translationReview";

const source: SourceSegment[] = [
  {
    segmentId: "seg_00001",
    page: 1,
    blockType: "paragraph",
    extractionMethod: "native",
    text: "The coefficient ⟦MATH_INLINE_00001⟧ equals 0.25.",
  },
];
const base = [
  {
    segmentId: "seg_00001",
    text: "El coeficiente ⟦MATH_INLINE_00001⟧ equivale a 0.25.",
  },
];

describe("post-translation review", () => {
  it("accepts a minor academic style correction and keeps the base", () => {
    const result = selectReviewedTranslations(
      source,
      base,
      [
        {
          segmentId: "seg_00001",
          text: "El coeficiente ⟦MATH_INLINE_00001⟧ es igual a 0.25.",
        },
      ],
      "normal",
    );
    expect(result[0]).toMatchObject({
      reviewStatus: "approved",
      baseText: base[0].text,
      text: "El coeficiente ⟦MATH_INLINE_00001⟧ es igual a 0.25.",
    });
  });

  it("retains the base when the reviewer changes math or numbers", () => {
    const result = selectReviewedTranslations(
      source,
      base,
      [
        {
          segmentId: "seg_00001",
          text: "El coeficiente es igual a 0.35.",
        },
      ],
      "strict",
    );
    expect(result[0].reviewStatus).toBe("base-retained");
    expect(result[0].text).toBe(base[0].text);
    expect(result[0].reviewWarnings).toEqual(
      expect.arrayContaining([
        "La revisión alteró marcadores matemáticos protegidos.",
        "La revisión cambió cifras, fechas o porcentajes.",
      ]),
    );
  });
});
