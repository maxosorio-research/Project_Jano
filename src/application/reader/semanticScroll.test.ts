import { describe, expect, it } from "vitest";
import type { Alignment } from "../../domain/processing";
import {
  followerScrollTop,
  mapSemanticPosition,
  type SegmentBounds,
} from "./semanticScroll";

const alignments: Alignment[] = [
  {
    alignmentId: "a1",
    sourceSegmentIds: ["s1"],
    targetSegmentIds: ["t1"],
    type: "1:1",
    method: "fixture",
  },
  {
    alignmentId: "a2",
    sourceSegmentIds: ["s2"],
    targetSegmentIds: ["t2", "t3"],
    type: "1:n",
    method: "fixture",
  },
];

const source: SegmentBounds[] = [
  { segmentId: "s1", start: 100, end: 200 },
  { segmentId: "s2", start: 300, end: 400 },
];
const translation: SegmentBounds[] = [
  { segmentId: "t1", start: 50, end: 150 },
  { segmentId: "t2", start: 250, end: 350 },
  { segmentId: "t3", start: 350, end: 500 },
];

describe("semantic scroll mapping", () => {
  it("interpolates within 1:n alignment intervals", () => {
    expect(
      mapSemanticPosition(alignments, source, translation, 350, "source"),
    ).toBe(375);
  });

  it("interpolates between reliable alignment intervals", () => {
    expect(
      mapSemanticPosition(alignments, source, translation, 250, "source"),
    ).toBe(200);
  });

  it("maps in the reverse direction", () => {
    expect(
      mapSemanticPosition(alignments, translation, source, 375, "translation"),
    ).toBe(350);
  });

  it("places the mapped content on the reading focus line", () => {
    expect(
      followerScrollTop(500, {
        scrollTop: 0,
        viewportHeight: 400,
        scrollHeight: 1_200,
        segments: [],
      }),
    ).toBe(360);
  });
});
