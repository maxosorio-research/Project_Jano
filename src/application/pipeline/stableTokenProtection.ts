import type { SourceSegment, TranslatedSegment } from "../../domain/processing";

export type StableToken = {
  segmentId: string;
  placeholder: string;
  source: string;
  kind: "number" | "reference";
};

const EXISTING_MARKER =
  /⟦(?:MATH_(?:INLINE|DISPLAY)|JANO_(?:NUMBER|REFERENCE))_\d{5}⟧/g;
const STABLE_VALUE_PATTERN =
  /https?:\/\/[^\s)\]}]+|\bdoi:\s*[^\s]+|\b10\.\d{4,9}\/[._;()/:A-Z0-9-]+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|(?<![\p{L}_])[-+]?\d+(?:[.,]\d+)*(?:\s*%)?/giu;

export function protectStableTokensInSegments(source: SourceSegment[]): {
  segments: SourceSegment[];
  tokens: StableToken[];
} {
  const tokens: StableToken[] = [];
  const segments = source.map((segment) => ({
    ...segment,
    text: replaceOutsideMarkers(segment.text, (value) => {
      const kind = isReference(value) ? "reference" : "number";
      const placeholder = `⟦JANO_${kind.toUpperCase()}_${String(tokens.length + 1).padStart(5, "0")}⟧`;
      tokens.push({
        segmentId: segment.segmentId,
        placeholder,
        source: value,
        kind,
      });
      return placeholder;
    }),
  }));
  return { segments, tokens };
}

export function validateStableTokenIntegrity(
  source: Array<{ segmentId: string; text: string }>,
  translations: TranslatedSegment[],
): void {
  const translatedById = new Map(
    translations.map((segment) => [segment.segmentId, segment.text]),
  );
  for (const segment of source) {
    const expected = stableTokenPlaceholders(segment.text);
    const received = stableTokenPlaceholders(
      translatedById.get(segment.segmentId) ?? "",
    );
    if (!sameSequence(expected, received)) {
      throw new Error(
        `Ollama no conservó los marcadores de cifras o referencias de ${segment.segmentId}.`,
      );
    }
  }
}

export function restoreStableTokens(
  translations: TranslatedSegment[],
  tokens: StableToken[],
): TranslatedSegment[] {
  const bySegment = new Map<string, StableToken[]>();
  for (const token of tokens) {
    const values = bySegment.get(token.segmentId) ?? [];
    values.push(token);
    bySegment.set(token.segmentId, values);
  }
  return translations.map((translation) => {
    const restore = (value: string): string => {
      let restored = value;
      for (const token of bySegment.get(translation.segmentId) ?? []) {
        restored = restored.replaceAll(token.placeholder, token.source);
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

export function stableTokenPlaceholders(text: string): string[] {
  return text.match(/⟦JANO_(?:NUMBER|REFERENCE)_\d{5}⟧/g) ?? [];
}

function replaceOutsideMarkers(
  text: string,
  replace: (value: string) => string,
): string {
  let result = "";
  let cursor = 0;
  for (const marker of text.matchAll(EXISTING_MARKER)) {
    const index = marker.index;
    result += text.slice(cursor, index).replace(STABLE_VALUE_PATTERN, replace);
    result += marker[0];
    cursor = index + marker[0].length;
  }
  return result + text.slice(cursor).replace(STABLE_VALUE_PATTERN, replace);
}

function isReference(value: string): boolean {
  return /^(?:https?:\/\/|doi:|10\.\d{4,9}\/)|@/i.test(value);
}

function sameSequence(first: string[], second: string[]): boolean {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}
