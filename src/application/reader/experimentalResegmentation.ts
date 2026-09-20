import type {
  Alignment,
  ReaderDocument,
  SourceSegment,
  TranslatedSegment,
} from "../../domain/processing";

const MIN_SENTENCE_GROUP_LENGTH = 90;
const MAX_SENTENCE_GROUP_LENGTH = 360;
const METHOD = "experimental-sentence-group-v1";

export type ExperimentalResegmentationReport = {
  originalSourceSegmentCount: number;
  sourceSegmentCount: number;
  originalTargetSegmentCount: number;
  targetSegmentCount: number;
  originalAlignmentCount: number;
  alignmentCount: number;
  subdividedAlignmentCount: number;
  paragraphFallbackCount: number;
};

export type ExperimentalResegmentationResult = {
  document: ReaderDocument;
  report: ExperimentalResegmentationReport;
};

type WeightedId = {
  id: string;
  length: number;
};

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function rawSentences(text: string, locale: string): string[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
    return Array.from(segmenter.segment(normalized), ({ segment }) =>
      segment.trim(),
    ).filter(Boolean);
  }

  return (normalized.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [normalized])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function sentenceGroups(text: string, locale: string): string[] {
  const sentences = rawSentences(text, locale);
  if (sentences.length <= 1) return sentences;

  const groups: string[] = [];
  let pending = "";

  for (const sentence of sentences) {
    if (!pending) {
      pending = sentence;
      continue;
    }

    const combined = `${pending} ${sentence}`;
    if (
      pending.length < MIN_SENTENCE_GROUP_LENGTH ||
      (sentence.length < MIN_SENTENCE_GROUP_LENGTH &&
        combined.length <= MAX_SENTENCE_GROUP_LENGTH)
    ) {
      pending = combined;
      continue;
    }

    groups.push(pending);
    pending = sentence;
  }

  if (pending) groups.push(pending);
  if (groups.length > 1 && groups.at(-1)!.length < MIN_SENTENCE_GROUP_LENGTH) {
    const previous = groups.at(-2)!;
    const last = groups.at(-1)!;
    if (`${previous} ${last}`.length <= MAX_SENTENCE_GROUP_LENGTH) {
      groups.splice(-2, 2, `${previous} ${last}`);
    }
  }

  return groups;
}

function canSubdivide(segment: SourceSegment | undefined): boolean {
  return (
    segment?.blockType === "paragraph" || segment?.blockType === "footnote"
  );
}

function childId(parentId: string, side: "s" | "t", index: number): string {
  return `${parentId}::${side}${String(index + 1).padStart(3, "0")}`;
}

function subdivideSourceSegment(segment: SourceSegment): SourceSegment[] {
  if (!canSubdivide(segment)) return [segment];
  const units = sentenceGroups(segment.text, "en");
  if (units.length <= 1) return [segment];

  return units.map((text, index) => ({
    ...segment,
    segmentId: childId(segment.segmentId, "s", index),
    parentSegmentId: segment.segmentId,
    unitOrdinal: index,
    text,
  }));
}

function subdivideTargetSegment(
  segment: TranslatedSegment,
  allowed: boolean,
): TranslatedSegment[] {
  if (!allowed) return [segment];
  const units = sentenceGroups(segment.text, "es");
  if (units.length <= 1) return [segment];

  return units.map((text, index) => ({
    segmentId: childId(segment.segmentId, "t", index),
    parentSegmentId: segment.segmentId,
    unitOrdinal: index,
    text,
    reviewStatus: segment.reviewStatus,
    reviewWarnings: segment.reviewWarnings,
  }));
}

function partitionContiguously(
  values: WeightedId[],
  groupCount: number,
): string[][] {
  if (groupCount <= 1) return [values.map((value) => value.id)];

  const prefix = [0];
  for (const value of values) {
    prefix.push(prefix.at(-1)! + Math.max(1, value.length));
  }
  const total = prefix.at(-1)!;
  const groups: string[][] = [];
  let start = 0;

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const groupsAfter = groupCount - groupIndex - 1;
    if (groupsAfter === 0) {
      groups.push(values.slice(start).map((value) => value.id));
      break;
    }

    const minimumEnd = start + 1;
    const maximumEnd = values.length - groupsAfter;
    const target = (total * (groupIndex + 1)) / groupCount;
    let bestEnd = minimumEnd;
    let bestDistance = Math.abs(prefix[minimumEnd] - target);

    for (let end = minimumEnd + 1; end <= maximumEnd; end += 1) {
      const distance = Math.abs(prefix[end] - target);
      if (distance < bestDistance) {
        bestEnd = end;
        bestDistance = distance;
      }
    }

    groups.push(values.slice(start, bestEnd).map((value) => value.id));
    start = bestEnd;
  }

  return groups;
}

function alignmentType(
  sourceIds: string[],
  targetIds: string[],
): Alignment["type"] {
  if (sourceIds.length === 1 && targetIds.length === 1) return "1:1";
  if (sourceIds.length === 1) return "1:n";
  if (targetIds.length === 1) return "n:1";
  return "n:m";
}

export function resegmentReaderDocument(
  document: ReaderDocument,
): ExperimentalResegmentationResult {
  const sourceById = new Map(
    document.segments.map((segment) => [segment.segmentId, segment]),
  );
  const splittableTargetIds = new Set<string>();

  for (const alignment of document.alignments) {
    if (
      alignment.sourceSegmentIds.some((segmentId) =>
        canSubdivide(sourceById.get(segmentId)),
      )
    ) {
      for (const targetId of alignment.targetSegmentIds) {
        splittableTargetIds.add(targetId);
      }
    }
  }

  const sourceChildren = new Map<string, SourceSegment[]>();
  const targetChildren = new Map<string, TranslatedSegment[]>();
  const segments = document.segments.flatMap((segment) => {
    const children = subdivideSourceSegment(segment);
    sourceChildren.set(segment.segmentId, children);
    return children;
  });
  const translations = document.translations.flatMap((segment) => {
    const children = subdivideTargetSegment(
      segment,
      splittableTargetIds.has(segment.segmentId),
    );
    targetChildren.set(segment.segmentId, children);
    return children;
  });
  const experimentalAlignments: Alignment[] = [];
  let subdividedAlignmentCount = 0;
  let paragraphFallbackCount = 0;

  for (const alignment of document.alignments) {
    const sourceUnits = alignment.sourceSegmentIds.flatMap(
      (segmentId) => sourceChildren.get(segmentId) ?? [],
    );
    const targetUnits = alignment.targetSegmentIds.flatMap(
      (segmentId) => targetChildren.get(segmentId) ?? [],
    );

    if (!sourceUnits.length || !targetUnits.length) {
      experimentalAlignments.push(alignment);
      continue;
    }

    const changed =
      sourceUnits.length !== alignment.sourceSegmentIds.length ||
      targetUnits.length !== alignment.targetSegmentIds.length;
    if (!changed) {
      experimentalAlignments.push(alignment);
      continue;
    }

    const groupCount = Math.min(sourceUnits.length, targetUnits.length);
    if (groupCount > 1) subdividedAlignmentCount += 1;
    else paragraphFallbackCount += 1;

    const sourceGroups = partitionContiguously(
      sourceUnits.map((segment) => ({
        id: segment.segmentId,
        length: segment.text.length,
      })),
      groupCount,
    );
    const targetGroups = partitionContiguously(
      targetUnits.map((segment) => ({
        id: segment.segmentId,
        length: segment.text.length,
      })),
      groupCount,
    );

    for (let index = 0; index < groupCount; index += 1) {
      const sourceSegmentIds = sourceGroups[index];
      const targetSegmentIds = targetGroups[index];
      experimentalAlignments.push({
        alignmentId: `exp:${alignment.alignmentId}:${String(index + 1).padStart(3, "0")}`,
        sourceSegmentIds,
        targetSegmentIds,
        type: alignmentType(sourceSegmentIds, targetSegmentIds),
        method: METHOD,
        confidence: Math.min(
          alignment.confidence ?? 1,
          sourceUnits.length === targetUnits.length ? 0.82 : 0.62,
        ),
      });
    }
  }

  return {
    document: {
      segments,
      translations,
      alignments: experimentalAlignments,
    },
    report: {
      originalSourceSegmentCount: document.segments.length,
      sourceSegmentCount: segments.length,
      originalTargetSegmentCount: document.translations.length,
      targetSegmentCount: translations.length,
      originalAlignmentCount: document.alignments.length,
      alignmentCount: experimentalAlignments.length,
      subdividedAlignmentCount,
      paragraphFallbackCount,
    },
  };
}
