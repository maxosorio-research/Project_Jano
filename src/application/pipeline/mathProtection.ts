import type {
  MathObject,
  SourceSegment,
  TranslatedSegment,
} from "../../domain/processing";

const MATH_PATTERN =
  /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([^\n]+?\\\)|\$[^$\n]+?\$|\b[pPrR]\s*(?:<|>|=|≤|≥|≠|≈)\s*-?\d+(?:[.,]\d+)?|\b[A-Za-z]\s*[_^]\s*(?:\{[^{}\n]+\}|[A-Za-z0-9]+)|\b[A-Za-z][₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹]+|[\p{Script=Greek}]|[∑∏∫√∞∂∆∇≤≥≠≈±×÷∈∉∪∩⊂⊆→←↔]/gu;

const GREEK_LATEX: Record<string, string> = {
  α: "\\alpha",
  β: "\\beta",
  γ: "\\gamma",
  δ: "\\delta",
  ε: "\\epsilon",
  θ: "\\theta",
  λ: "\\lambda",
  μ: "\\mu",
  π: "\\pi",
  ρ: "\\rho",
  σ: "\\sigma",
  τ: "\\tau",
  φ: "\\phi",
  χ: "\\chi",
  ψ: "\\psi",
  ω: "\\omega",
  Γ: "\\Gamma",
  Δ: "\\Delta",
  Θ: "\\Theta",
  Λ: "\\Lambda",
  Π: "\\Pi",
  Σ: "\\Sigma",
  Φ: "\\Phi",
  Ψ: "\\Psi",
  Ω: "\\Omega",
};

export function protectMathInSegments(source: SourceSegment[]): {
  segments: SourceSegment[];
  mathObjects: MathObject[];
} {
  const mathObjects: MathObject[] = [];
  const segments = source.map((segment) => {
    if (segment.blockType === "equation-marker") {
      const mathId = `math_${String(mathObjects.length + 1).padStart(5, "0")}`;
      const placeholder = `⟦MATH_DISPLAY_${String(mathObjects.length + 1).padStart(5, "0")}⟧`;
      const latex = inferredLatex(segment.text);
      mathObjects.push({
        mathId,
        segmentId: segment.segmentId,
        type: "display",
        page: segment.page,
        placeholder,
        source: segment.text,
        latex,
        confidence: latex ? 0.95 : 0.55,
        originalCrop: null,
      });
      return { ...segment, text: placeholder };
    }
    return {
      ...segment,
      text: segment.text.replace(MATH_PATTERN, (match) => {
        const mathId = `math_${String(mathObjects.length + 1).padStart(5, "0")}`;
        const type = isDisplayMath(match) ? "display" : "inline";
        const placeholder = `⟦MATH_${type.toUpperCase()}_${String(mathObjects.length + 1).padStart(5, "0")}⟧`;
        const latex = inferredLatex(match);
        mathObjects.push({
          mathId,
          segmentId: segment.segmentId,
          type,
          page: segment.page,
          placeholder,
          source: match,
          latex,
          confidence: latex ? 0.95 : 0.65,
          originalCrop: null,
        });
        return placeholder;
      }),
    };
  });
  return { segments, mathObjects };
}

export function validateMathIntegrity(
  source: Array<{ segmentId: string; text: string }>,
  translations: TranslatedSegment[],
): void {
  const translatedById = new Map(
    translations.map((segment) => [segment.segmentId, segment.text]),
  );
  for (const segment of source) {
    const expected = mathPlaceholders(segment.text);
    const translated = translatedById.get(segment.segmentId) ?? "";
    const received = mathPlaceholders(translated);
    if (
      expected.length !== received.length ||
      expected.some((placeholder, index) => placeholder !== received[index])
    ) {
      throw new Error(
        `Ollama no conservó los marcadores matemáticos de ${segment.segmentId}.`,
      );
    }
  }
}

export function restoreMathInTranslations(
  translations: TranslatedSegment[],
  mathObjects: MathObject[],
  mode: "plain" | "markdown" = "plain",
): TranslatedSegment[] {
  const bySegment = new Map<string, MathObject[]>();
  for (const math of mathObjects) {
    const values = bySegment.get(math.segmentId) ?? [];
    values.push(math);
    bySegment.set(math.segmentId, values);
  }
  return translations.map((translation) => {
    const restore = (value: string): string => {
      let restored = value;
      for (const math of bySegment.get(translation.segmentId) ?? []) {
        const replacement =
          mode === "markdown" && math.latex && math.confidence >= 0.9
            ? math.type === "display"
              ? `\n\n$$${math.latex}$$\n\n`
              : `$${math.latex}$`
            : mode === "markdown"
              ? literalMathForMarkdown(math)
              : math.source;
        restored = restored.replaceAll(math.placeholder, replacement);
      }
      return restored;
    };
    return {
      ...translation,
      text: restore(translation.text),
      ...(translation.baseText === undefined
        ? {}
        : { baseText: restore(translation.baseText) }),
      ...(translation.reviewedText === undefined ||
      translation.reviewedText === null
        ? {}
        : { reviewedText: restore(translation.reviewedText) }),
    };
  });
}

function literalMathForMarkdown(math: MathObject): string {
  const source = math.source.replace(/`/g, "\\`");
  return math.type === "display"
    ? `\n\n~~~text\n${source}\n~~~\n\n`
    : `\`${source}\``;
}

export function mathPlaceholders(text: string): string[] {
  return text.match(/⟦MATH_(?:INLINE|DISPLAY)_\d{5}⟧/g) ?? [];
}

function isDisplayMath(value: string): boolean {
  return value.startsWith("$$") || value.startsWith("\\[");
}

function inferredLatex(value: string): string | null {
  if (value.startsWith("$$") && value.endsWith("$$")) return value.slice(2, -2);
  if (
    (value.startsWith("\\(") && value.endsWith("\\)")) ||
    (value.startsWith("\\[") && value.endsWith("\\]"))
  ) {
    return value.slice(2, -2);
  }
  if (value.startsWith("$") && value.endsWith("$")) return value.slice(1, -1);
  if (GREEK_LATEX[value]) return GREEK_LATEX[value];
  if (/^[A-Za-z]\s*[_^]/.test(value)) {
    return value
      .replace(/\s+/g, "")
      .replace(/_([A-Za-z0-9]+)$/, "_{$1}")
      .replace(/\^([A-Za-z0-9]+)$/, "^{$1}");
  }
  if (/^[pPrR]\s*(?:<|>|=|≤|≥|≠|≈)/.test(value)) {
    return value
      .replace(/≤/g, "\\le ")
      .replace(/≥/g, "\\ge ")
      .replace(/≠/g, "\\ne ")
      .replace(/≈/g, "\\approx ")
      .replace(",", ".");
  }
  return null;
}
