import { PDF_FOOTNOTE_BOUNDARY } from "../../application/ports/PdfDocumentAdapter";

export type PositionedPdfText = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceIndex: number;
};

export type PdfPageSpace = {
  width: number;
  height: number;
};

type Axis = "horizontal" | "vertical";

type Cut = {
  axis: Axis;
  position: number;
  score: number;
};

type Range = {
  start: number;
  end: number;
};

type TextLine = {
  items: PositionedPdfText[];
  minY: number;
  maxY: number;
  baseline: number;
  referenceHeight: number;
};

const MAX_PARTITION_DEPTH = 32;

export function reconstructPdfReadingOrder(
  sourceItems: PositionedPdfText[],
  page: PdfPageSpace,
): string {
  const items = sourceItems.filter(
    (item) =>
      item.text.trim() &&
      Number.isFinite(item.x) &&
      Number.isFinite(item.y) &&
      Number.isFinite(item.width) &&
      Number.isFinite(item.height),
  );
  if (!items.length) return "";

  const footnoteTop = detectFootnoteTop(items, page);
  if (footnoteTop !== null) {
    const body = items.filter((item) => item.y + item.height / 2 > footnoteTop);
    const footnotes = items.filter(
      (item) => item.y + item.height / 2 <= footnoteTop,
    );
    return [
      orderedText(body, page),
      PDF_FOOTNOTE_BOUNDARY,
      orderedText(footnotes, page),
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  return orderedText(items, page);
}

function orderedText(items: PositionedPdfText[], page: PdfPageSpace): string {
  return partitionIntoReadingRegions(items, page)
    .map(regionText)
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function detectFootnoteTop(
  items: PositionedPdfText[],
  page: PdfPageSpace,
): number | null {
  const typicalHeight = percentile(
    items.map((item) => Math.max(item.height, 1)),
    0.75,
  );
  const lowerSmallText = items.filter(
    (item) =>
      item.y + item.height / 2 <= page.height * 0.25 &&
      item.height <= typicalHeight * 0.86,
  );
  const footnoteLabel = /^(?:\d{1,3}\s*[.)]|[*†‡])(?:\s|$)/u;
  const hasFootnoteLabel =
    lowerSmallText.some((item) => footnoteLabel.test(item.text.trim())) ||
    renderLines(lowerSmallText)
      .split("\n")
      .some((line) => footnoteLabel.test(line));
  if (!hasFootnoteLabel) return null;
  return (
    Math.max(...lowerSmallText.map((item) => item.y + item.height)) +
    typicalHeight * 0.35
  );
}

function partitionIntoReadingRegions(
  items: PositionedPdfText[],
  page: PdfPageSpace,
  depth = 0,
): PositionedPdfText[][] {
  if (items.length < 2 || depth >= MAX_PARTITION_DEPTH) return [items];
  const cut = selectCut(items, page);
  if (!cut) return [items];

  if (cut.axis === "horizontal") {
    const upper = items.filter(
      (item) => item.y + item.height / 2 > cut.position,
    );
    const lower = items.filter(
      (item) => item.y + item.height / 2 < cut.position,
    );
    if (!upper.length || !lower.length) return [items];
    return [
      ...partitionIntoReadingRegions(upper, page, depth + 1),
      ...partitionIntoReadingRegions(lower, page, depth + 1),
    ];
  }

  const left = items.filter((item) => item.x + item.width / 2 < cut.position);
  const right = items.filter((item) => item.x + item.width / 2 > cut.position);
  if (!left.length || !right.length) return [items];
  return [
    ...partitionIntoReadingRegions(left, page, depth + 1),
    ...partitionIntoReadingRegions(right, page, depth + 1),
  ];
}

function selectCut(items: PositionedPdfText[], page: PdfPageSpace): Cut | null {
  const typicalHeight = median(items.map((item) => Math.max(item.height, 1)));
  const horizontalMinimum = Math.max(typicalHeight * 1.15, page.height * 0.012);
  const verticalMinimum = Math.max(typicalHeight * 1.25, page.width * 0.018);

  const horizontal = largestInternalGap(
    items.map((item) => ({ start: item.y, end: item.y + item.height })),
    horizontalMinimum,
  );
  const vertical = largestInternalGap(
    items.map((item) => ({ start: item.x, end: item.x + item.width })),
    verticalMinimum,
  );
  const candidates: Cut[] = [];
  if (horizontal) {
    candidates.push({
      axis: "horizontal",
      position: horizontal.position,
      score: (horizontal.size / horizontalMinimum) * 1.08,
    });
  }
  if (vertical) {
    candidates.push({
      axis: "vertical",
      position: vertical.position,
      score: vertical.size / verticalMinimum,
    });
  }
  return candidates.sort((left, right) => right.score - left.score)[0] ?? null;
}

function largestInternalGap(ranges: Range[], minimum: number) {
  const merged = mergeRanges(ranges);
  let largest: { position: number; size: number } | null = null;
  for (let index = 1; index < merged.length; index += 1) {
    const start = merged[index - 1].end;
    const end = merged[index].start;
    const size = end - start;
    if (size >= minimum && (!largest || size > largest.size)) {
      largest = { position: start + size / 2, size };
    }
  }
  return largest;
}

function mergeRanges(ranges: Range[]): Range[] {
  const sorted = ranges
    .map((range) => ({
      start: Math.min(range.start, range.end),
      end: Math.max(range.start, range.end),
    }))
    .sort((left, right) => left.start - right.start);
  const merged: Range[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
    } else {
      previous.end = Math.max(previous.end, range.end);
    }
  }
  return merged;
}

function regionText(items: PositionedPdfText[]): string {
  const sourceRuns = splitAtVerticalSourceResets(items);
  if (sourceRuns.length > 1) {
    return sourceRuns.map(renderLines).filter(Boolean).join("\n\n");
  }
  return renderLines(items);
}

function renderLines(items: PositionedPdfText[]): string {
  const lines = groupLines(items).sort(
    (left, right) =>
      right.baseline - left.baseline || lineStart(left) - lineStart(right),
  );
  return lines.map(lineText).filter(Boolean).join("\n");
}

function splitAtVerticalSourceResets(
  items: PositionedPdfText[],
): PositionedPdfText[][] {
  const ordered = [...items].sort(
    (left, right) => left.sourceIndex - right.sourceIndex,
  );
  const typicalHeight = median(items.map((item) => Math.max(item.height, 1)));
  const runs: PositionedPdfText[][] = [];
  let current: PositionedPdfText[] = [];
  let previous: PositionedPdfText | null = null;
  for (const item of ordered) {
    const verticalReset = previous && item.y - previous.y > typicalHeight * 1.5;
    if (verticalReset && current.length) {
      runs.push(current);
      current = [];
    }
    current.push(item);
    previous = item;
  }
  if (current.length) runs.push(current);
  return runs;
}

function groupLines(items: PositionedPdfText[]): TextLine[] {
  const lines: TextLine[] = [];
  const ordered = [...items].sort(
    (left, right) =>
      right.y - left.y ||
      left.x - right.x ||
      left.sourceIndex - right.sourceIndex,
  );
  for (const item of ordered) {
    const itemMinY = item.y;
    const itemMaxY = item.y + Math.max(item.height, 1);
    const matchingLines = lines
      .map((candidate) => ({
        candidate,
        distance: Math.abs(candidate.baseline - item.y),
        overlap:
          Math.min(candidate.maxY, itemMaxY) -
          Math.max(candidate.minY, itemMinY),
      }))
      .filter(
        ({ candidate, distance, overlap }) =>
          overlap >=
            Math.min(item.height, candidate.maxY - candidate.minY) * 0.35 ||
          distance <=
            Math.max(
              1.5,
              Math.min(item.height, candidate.maxY - candidate.minY) * 0.3,
            ),
      );
    const spansSeveralLines = matchingLines.some(
      ({ candidate }) => item.height > candidate.referenceHeight * 1.8,
    );
    const line = matchingLines.sort((left, right) =>
      spansSeveralLines
        ? right.candidate.baseline - left.candidate.baseline
        : left.distance - right.distance,
    )[0]?.candidate;

    if (!line) {
      lines.push({
        items: [item],
        minY: itemMinY,
        maxY: itemMaxY,
        baseline: item.y,
        referenceHeight: item.height,
      });
      continue;
    }
    line.items.push(item);
    if (item.height <= line.referenceHeight * 1.8) {
      line.minY = Math.min(line.minY, itemMinY);
      line.maxY = Math.max(line.maxY, itemMaxY);
      const baselineItems = line.items.filter(
        (entry) =>
          entry.height >= line.referenceHeight * 0.75 &&
          entry.height <= line.referenceHeight * 1.8,
      );
      line.baseline = median(baselineItems.map((entry) => entry.y));
      line.referenceHeight = median(baselineItems.map((entry) => entry.height));
    }
  }
  return lines;
}

function lineText(line: TextLine): string {
  const items = [...line.items].sort(
    (left, right) => left.x - right.x || left.sourceIndex - right.sourceIndex,
  );
  let result = "";
  let previous: PositionedPdfText | null = null;
  for (const item of items) {
    const text = item.text.trim();
    if (!text) continue;
    if (previous && needsSpace(previous, item, result, text)) result += " ";
    result += text;
    previous = item;
  }
  return result.trim();
}

function needsSpace(
  previous: PositionedPdfText,
  current: PositionedPdfText,
  accumulated: string,
  currentText: string,
): boolean {
  if (/\s$/.test(accumulated) || /^[,.;:!?%)\]}]/.test(currentText)) {
    return false;
  }
  if (/[([{¿¡]$/.test(accumulated)) return false;
  if (/\s$/.test(previous.text)) return true;

  const gap = current.x - (previous.x + previous.width);
  const typicalCharacterWidth = Math.min(
    characterWidth(previous),
    characterWidth(current),
  );
  const raisedSmallText =
    previous.height <= current.height * 1.8 &&
    current.height < previous.height * 0.75 &&
    current.y > previous.y + previous.height * 0.15;
  return raisedSmallText || gap > Math.max(0.8, typicalCharacterWidth * 0.18);
}

function characterWidth(item: PositionedPdfText): number {
  return item.width / Math.max(item.text.trim().length, 1);
}

function lineStart(line: TextLine): number {
  return Math.min(...line.items.map((item) => item.x));
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values: number[], quantile: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil((sorted.length - 1) * quantile)];
}
