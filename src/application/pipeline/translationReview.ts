import type {
  SourceSegment,
  TranslatedSegment,
  TranslationReviewStatus,
} from "../../domain/processing";
import { mathPlaceholders } from "./mathProtection";
import { stableTokenPlaceholders } from "./stableTokenProtection";

export function selectReviewedTranslations(
  source: SourceSegment[],
  base: TranslatedSegment[],
  reviewed: TranslatedSegment[] | null,
  reviewLevel: "none" | "normal" | "strict",
): TranslatedSegment[] {
  const sourceById = new Map(
    source.map((segment) => [segment.segmentId, segment]),
  );
  const reviewedById = new Map(
    (reviewed ?? []).map((segment) => [segment.segmentId, segment]),
  );

  return base.map((baseSegment) => {
    if (reviewLevel === "none" || !reviewed) {
      return reviewRecord(baseSegment, null, "not-reviewed", []);
    }
    const candidate = reviewedById.get(baseSegment.segmentId);
    if (!candidate?.text.trim()) {
      return reviewRecord(baseSegment, null, "needs-review", [
        "El revisor no devolvió este segmento.",
      ]);
    }
    const warnings = revisionWarnings(
      sourceById.get(baseSegment.segmentId)?.text ?? "",
      baseSegment.text,
      candidate.text,
      reviewLevel,
    );
    return warnings.length
      ? reviewRecord(baseSegment, candidate.text, "base-retained", warnings)
      : reviewRecord(baseSegment, candidate.text, "approved", []);
  });
}

function reviewRecord(
  base: TranslatedSegment,
  reviewedText: string | null,
  status: TranslationReviewStatus,
  warnings: string[],
): TranslatedSegment {
  return {
    segmentId: base.segmentId,
    text: status === "approved" ? (reviewedText ?? base.text) : base.text,
    baseText: base.text,
    reviewedText,
    reviewStatus: status,
    reviewWarnings: warnings,
  };
}

function revisionWarnings(
  source: string,
  base: string,
  reviewed: string,
  reviewLevel: "normal" | "strict",
): string[] {
  const warnings: string[] = [];
  if (!sameSequence(mathPlaceholders(base), mathPlaceholders(reviewed))) {
    warnings.push("La revisión alteró marcadores matemáticos protegidos.");
  }
  if (
    !sameSequence(
      stableTokenPlaceholders(base),
      stableTokenPlaceholders(reviewed),
    )
  ) {
    warnings.push("La revisión alteró cifras o referencias protegidas.");
  }
  if (!sameSequence(numericTokens(base), numericTokens(reviewed))) {
    warnings.push("La revisión cambió cifras, fechas o porcentajes.");
  }
  if (!sameSequence(referenceTokens(base), referenceTokens(reviewed))) {
    warnings.push("La revisión cambió una URL, DOI o dirección electrónica.");
  }
  const ratio = reviewed.trim().length / Math.max(1, base.trim().length);
  const bounds = reviewLevel === "strict" ? [0.72, 1.38] : [0.58, 1.65];
  if (ratio < bounds[0] || ratio > bounds[1]) {
    warnings.push("La revisión cambió demasiado la extensión del segmento.");
  }
  if (
    reviewLevel === "strict" &&
    source.trim() &&
    reviewed.trim().length < 20
  ) {
    warnings.push("La revisión estricta produjo un resultado demasiado breve.");
  }
  return warnings;
}

function numericTokens(value: string): string[] {
  return value.match(/(?<![\p{L}_])[-+]?\d+(?:[.,]\d+)*(?:\s*%)?/gu) ?? [];
}

function referenceTokens(value: string): string[] {
  return (
    value.match(
      /https?:\/\/[^\s)]+|\bdoi:\s*[^\s]+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/gi,
    ) ?? []
  );
}

function sameSequence(first: string[], second: string[]): boolean {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}
