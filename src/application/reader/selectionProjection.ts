import type { Alignment } from "../../domain/processing";
import type { ReaderSide } from "./semanticScroll";

export type SemanticSelection = {
  side: ReaderSide;
  segmentIds: string[];
};

function selectionRangeWithin(root: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (
    !selection ||
    selection.isCollapsed ||
    selection.rangeCount === 0 ||
    !selection.anchorNode ||
    !selection.focusNode ||
    !root.contains(selection.anchorNode) ||
    !root.contains(selection.focusNode)
  ) {
    return null;
  }
  return selection.getRangeAt(0);
}

export function selectedDomSegmentIds(
  root: HTMLElement,
  selector: string,
): string[] {
  const range = selectionRangeWithin(root);
  if (!range) return [];

  return Array.from(root.querySelectorAll<HTMLElement>(selector))
    .filter((element) => {
      try {
        return range.intersectsNode(element);
      } catch {
        return false;
      }
    })
    .map((element) => element.dataset.segmentId ?? "")
    .filter(Boolean);
}

export function selectedOverlappingSegmentIds(
  root: HTMLElement,
  selector: string,
): string[] {
  const range = selectionRangeWithin(root);
  if (!range) return [];

  const selectionRects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  );
  if (!selectionRects.length) return [];

  return Array.from(root.querySelectorAll<HTMLElement>(selector))
    .filter((element) => {
      const elementRect = element.getBoundingClientRect();
      return selectionRects.some(
        (selectionRect) =>
          selectionRect.bottom >= elementRect.top &&
          selectionRect.top <= elementRect.bottom &&
          selectionRect.right >= elementRect.left &&
          selectionRect.left <= elementRect.right,
      );
    })
    .map((element) => element.dataset.segmentId ?? "")
    .filter(Boolean);
}

export function projectedSegmentIds(
  alignments: Alignment[],
  selection: SemanticSelection | null,
  targetSide: ReaderSide,
): string[] {
  if (!selection || selection.side === targetSide) return [];

  const selected = new Set(selection.segmentIds);
  const projected: string[] = [];
  const seen = new Set<string>();

  for (const alignment of alignments) {
    const selectedSideIds =
      selection.side === "source"
        ? alignment.sourceSegmentIds
        : alignment.targetSegmentIds;
    if (!selectedSideIds.some((segmentId) => selected.has(segmentId))) {
      continue;
    }

    const targetIds =
      targetSide === "source"
        ? alignment.sourceSegmentIds
        : alignment.targetSegmentIds;
    for (const segmentId of targetIds) {
      if (!seen.has(segmentId)) {
        seen.add(segmentId);
        projected.push(segmentId);
      }
    }
  }

  return projected;
}
