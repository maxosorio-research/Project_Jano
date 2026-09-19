import { describe, expect, it } from "vitest";
import type { SourceSegment } from "../../domain/processing";
import {
  protectMathInSegments,
  restoreMathInTranslations,
  validateMathIntegrity,
} from "./mathProtection";

const source: SourceSegment[] = [
  {
    segmentId: "seg_00001",
    page: 4,
    blockType: "paragraph",
    extractionMethod: "native",
    text: "The parameter β changes X_{ij} when p < 0.05.",
  },
];

describe("math protection", () => {
  it("protects, validates and restores inline notation", () => {
    const protectedDocument = protectMathInSegments(source);
    expect(protectedDocument.mathObjects).toHaveLength(3);
    expect(protectedDocument.segments[0].text).not.toContain("β");

    const translated = [
      {
        segmentId: "seg_00001",
        text: protectedDocument.segments[0].text.replace(
          "The parameter",
          "El parámetro",
        ),
      },
    ];
    expect(() =>
      validateMathIntegrity(protectedDocument.segments, translated),
    ).not.toThrow();
    expect(
      restoreMathInTranslations(
        translated,
        protectedDocument.mathObjects,
        "plain",
      )[0].text,
    ).toBe("El parámetro β changes X_{ij} when p < 0.05.");
    expect(
      restoreMathInTranslations(
        translated,
        protectedDocument.mathObjects,
        "markdown",
      )[0].text,
    ).toContain("$\\beta$");
  });

  it("rejects a translation that changes a protected marker", () => {
    const protectedDocument = protectMathInSegments(source);
    expect(() =>
      validateMathIntegrity(protectedDocument.segments, [
        { segmentId: "seg_00001", text: "Sin marcadores." },
      ]),
    ).toThrow("marcadores matemáticos");
  });

  it("protects a detected display equation as one indivisible object", () => {
    const equation: SourceSegment[] = [
      {
        segmentId: "seg_00002",
        page: 5,
        blockType: "equation-marker",
        extractionMethod: "native",
        text: "Γr(Y) = ∑ YijYji. (2)",
      },
    ];
    const protectedDocument = protectMathInSegments(equation);

    expect(protectedDocument.mathObjects).toHaveLength(1);
    expect(protectedDocument.mathObjects[0]).toMatchObject({
      type: "display",
      source: "Γr(Y) = ∑ YijYji. (2)",
    });
    expect(protectedDocument.segments[0].text).toBe("⟦MATH_DISPLAY_00001⟧");

    const restored = restoreMathInTranslations(
      [
        {
          segmentId: "seg_00002",
          text: protectedDocument.segments[0].text,
        },
      ],
      protectedDocument.mathObjects,
      "markdown",
    )[0].text;
    expect(restored).toContain("~~~text");
    expect(restored).toContain("Γr(Y) = ∑ YijYji. (2)");
    expect(restored).not.toContain("$$");
  });
});
