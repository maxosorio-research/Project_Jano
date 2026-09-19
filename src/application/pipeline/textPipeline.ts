import type {
  ProcessingMethod,
  SourceSegment,
  TranslatedSegment,
} from "../../domain/processing";
import type { PdfPageVisualSummary } from "../ports/PdfDocumentAdapter";

const MAX_SEGMENT_CHARACTERS = 1_400;
const MAX_BATCH_CHARACTERS = 3_200;
const MAX_BATCH_SEGMENTS = 12;

export type ExtractedPage = {
  page: number;
  text: string;
  method: ProcessingMethod;
  visuals?: PdfPageVisualSummary;
};

export function hasUsableNativeText(text: string): boolean {
  const compact = text.replace(/\s/g, "");
  if (compact.length < 80) return false;
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
  if (words.length < 12) return false;
  const letters = compact.match(/\p{L}/gu)?.length ?? 0;
  const replacementCharacters = text.match(/\uFFFD/g)?.length ?? 0;
  return (
    letters / compact.length >= 0.45 &&
    replacementCharacters / compact.length < 0.02
  );
}

export function normalizePageText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00ad/g, "")
    .replace(/([\p{L}])-\n(?=[\p{Ll}])/gu, "$1")
    .split(/\n\s*\n+/)
    .map((paragraph) =>
      paragraph
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n\n");
}

export function segmentExtractedPages(pages: ExtractedPage[]): SourceSegment[] {
  const segments: SourceSegment[] = [];
  for (const page of pages) {
    const paragraphs = logicalPageBlocks(page.text);
    let hasVisualMarker = false;
    for (const paragraph of paragraphs.flatMap(splitLongParagraph)) {
      const blockType = classifyBlock(paragraph);
      hasVisualMarker ||=
        blockType === "figure-marker" || blockType === "table-marker";
      segments.push({
        segmentId: `seg_${String(segments.length + 1).padStart(5, "0")}`,
        page: page.page,
        blockType,
        text: paragraph,
        extractionMethod: page.method,
      });
    }
    if (!hasVisualMarker && hasSignificantUncaptionedVisual(page.visuals)) {
      segments.push({
        segmentId: `seg_${String(segments.length + 1).padStart(5, "0")}`,
        page: page.page,
        blockType: "figure-marker",
        text: "Visual content detected in the original document.",
        extractionMethod: page.method,
      });
    }
  }
  return segments;
}

export function batchSegments(segments: SourceSegment[]): SourceSegment[][] {
  const batches: SourceSegment[][] = [];
  let current: SourceSegment[] = [];
  let size = 0;
  for (const segment of segments) {
    if (
      current.length &&
      (current.length >= MAX_BATCH_SEGMENTS ||
        size + segment.text.length > MAX_BATCH_CHARACTERS)
    ) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(segment);
    size += segment.text.length;
  }
  if (current.length) batches.push(current);
  return batches;
}

export function validateTranslations(
  source: SourceSegment[],
  translations: TranslatedSegment[],
): void {
  const expected = new Set(source.map((segment) => segment.segmentId));
  const received = new Set(translations.map((segment) => segment.segmentId));
  if (
    expected.size !== received.size ||
    [...expected].some((segmentId) => !received.has(segmentId)) ||
    translations.some((segment) => !segment.text.trim())
  ) {
    throw new Error(
      "La traducción no conservó todos los segmentos; no se guardó ningún resultado.",
    );
  }
}

export function validateStableTokens(
  source: Array<{ segmentId: string; text: string }>,
  translations: TranslatedSegment[],
): void {
  const translatedById = new Map(
    translations.map((segment) => [segment.segmentId, segment.text]),
  );
  for (const segment of source) {
    const translated = translatedById.get(segment.segmentId) ?? "";
    if (
      !sameTokens(numericTokens(segment.text), numericTokens(translated)) ||
      !sameTokens(referenceTokens(segment.text), referenceTokens(translated))
    ) {
      throw new Error(
        `Ollama no conservó las cifras o referencias de ${segment.segmentId}.`,
      );
    }
  }
}

export function sourceTextArtifact(pages: ExtractedPage[]): string {
  return pages
    .map(
      (page) =>
        `--- Página ${page.page} · ${page.method.toUpperCase()} ---\n\n${normalizePageText(page.text)}`,
    )
    .join("\n\n");
}

export function translatedMarkdown(
  source: SourceSegment[],
  translations: TranslatedSegment[],
): string {
  const byId = new Map(
    translations.map((segment) => [segment.segmentId, segment.text.trim()]),
  );
  const markdown: string[] = [];
  let currentPage: number | null = null;
  for (const segment of source) {
    if (segment.page !== currentPage) {
      currentPage = segment.page;
      markdown.push(pageMarker(segment.page));
    }
    const text = byId.get(segment.segmentId) ?? "";
    if (segment.blockType === "heading") markdown.push(`## ${text}`);
    else if (segment.blockType === "figure-marker") {
      markdown.push(
        `> **Figura o gráfica en el original · página ${segment.page}.**\n>\n> ${text}`,
      );
    } else if (segment.blockType === "table-marker") {
      markdown.push(
        `> **Tabla en el original · página ${segment.page}.**\n>\n> ${text}`,
      );
    } else markdown.push(text);
  }
  return markdown.join("\n\n");
}

export function pageMarker(page: number): string {
  return `------------[Página N° ${page}]------------`;
}

export function stripReaderMetadata(markdown: string): string {
  return markdown.replace(
    /^\s*<!--\s*seg_\d+\s*·\s*página\s+\d+\s*-->\s*$/gim,
    "",
  );
}

function looksLikeHeading(text: string): boolean {
  const words = text.split(/\s+/);
  return (
    text.length <= 140 &&
    words.length <= 16 &&
    !/[.!?;:]$/.test(text) &&
    !/https?:\/\/|\bdoi\b|@|©|all rights reserved/i.test(text)
  );
}

function classifyBlock(text: string): SourceSegment["blockType"] {
  if (looksLikeFigureCaption(text)) return "figure-marker";
  if (looksLikeTableCaption(text)) return "table-marker";
  if (looksLikeDisplayEquation(text)) return "equation-marker";
  return looksLikeHeading(text) ? "heading" : "paragraph";
}

function logicalPageBlocks(text: string): string[] {
  const prepared = text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00ad/g, "")
    .replace(/([\p{L}])-\n(?=[\p{Ll}])/gu, "$1");
  const blocks: string[] = [];
  let prose: string[] = [];
  let captionIndex: number | null = null;
  const flushProse = () => {
    const value = prose.join(" ").replace(/\s+/g, " ").trim();
    if (value) blocks.push(value);
    prose = [];
  };

  for (const rawLine of prepared.split("\n")) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) {
      flushProse();
      captionIndex = null;
    } else if (looksLikeFigureCaption(line) || looksLikeTableCaption(line)) {
      flushProse();
      blocks.push(line);
      captionIndex = blocks.length - 1;
    } else if (looksLikeDisplayEquation(line)) {
      flushProse();
      blocks.push(line);
      captionIndex = null;
    } else if (captionIndex !== null) {
      blocks[captionIndex] = `${blocks[captionIndex]} ${line}`;
    } else {
      prose.push(line);
    }
  }
  flushProse();
  return blocks;
}

function looksLikeFigureCaption(text: string): boolean {
  return /^(?:figure|fig\.?|graph|chart|diagram|plot|figura|gr[aá]fic[oa]|graphe|abbildung)\s*(?:\d+|[ivxlcdm]+)?(?:[.:(\s—-]|$)/i.test(
    text,
  );
}

function looksLikeTableCaption(text: string): boolean {
  return /^(?:table|tabla|tableau|tabelle)\s*(?:\d+|[ivxlcdm]+)?(?:[.:(\s—-]|$)/i.test(
    text,
  );
}

function looksLikeDisplayEquation(text: string): boolean {
  if (/^(?:equation|eq\.?|ecuaci[oó]n)\s*\(?\d+/i.test(text)) return true;
  if (/^\$\$[\s\S]+\$\$$|^\\\[[\s\S]+\\\]$/.test(text)) return true;
  if (text.length > 260 || !/[=≤≥≠≈∑∏∫√]/u.test(text)) return false;
  const proseWords = text.match(/\p{L}{3,}/gu) ?? [];
  const mathSignals = text.match(
    /[=≤≥≠≈∑∏∫√∞∂∆∇±×÷]|[\p{L}]\s*[_^]|[₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹]/gu,
  );
  return (mathSignals?.length ?? 0) >= 2 && proseWords.length <= 10;
}

function hasSignificantUncaptionedVisual(
  summary: PdfPageVisualSummary | undefined,
): boolean {
  return Boolean(
    summary && (summary.imageCount >= 2 || summary.vectorPathCount >= 24),
  );
}

function splitLongParagraph(paragraph: string): string[] {
  if (paragraph.length <= MAX_SEGMENT_CHARACTERS) return [paragraph];
  const sentences = paragraph.match(/[^.!?]+(?:[.!?]+[”"']?|$)/g) ?? [
    paragraph,
  ];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (
      current &&
      current.length + trimmed.length + 1 > MAX_SEGMENT_CHARACTERS
    ) {
      chunks.push(current);
      current = "";
    }
    current = current ? `${current} ${trimmed}` : trimmed;
  }
  if (current) chunks.push(current);
  return chunks;
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

function sameTokens(first: string[], second: string[]): boolean {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}
