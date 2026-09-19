import { describe, expect, it } from "vitest";
import type { Alignment } from "../../domain/processing";
import { projectedSegmentIds } from "./selectionProjection";

const alignments: Alignment[] = [
  {
    alignmentId: "a1",
    sourceSegmentIds: ["s1"],
    targetSegmentIds: ["t1", "t2"],
    type: "1:n",
    method: "fixture",
  },
  {
    alignmentId: "a2",
    sourceSegmentIds: ["s2", "s3"],
    targetSegmentIds: ["t3"],
    type: "n:1",
    method: "fixture",
  },
];

describe("semantic selection projection", () => {
  it("projects a source selection to the complete target alignment group", () => {
    expect(
      projectedSegmentIds(
        alignments,
        { side: "source", segmentIds: ["s1"] },
        "translation",
      ),
    ).toEqual(["t1", "t2"]);
  });

  it("projects a translation selection back to every source segment", () => {
    expect(
      projectedSegmentIds(
        alignments,
        { side: "translation", segmentIds: ["t3"] },
        "source",
      ),
    ).toEqual(["s2", "s3"]);
  });

  it("does not project into the side that owns the real selection", () => {
    expect(
      projectedSegmentIds(
        alignments,
        { side: "source", segmentIds: ["s1"] },
        "source",
      ),
    ).toEqual([]);
  });

  it("returns no counterpart for an unaligned selection", () => {
    expect(
      projectedSegmentIds(
        alignments,
        { side: "translation", segmentIds: ["missing"] },
        "source",
      ),
    ).toEqual([]);
  });
});
