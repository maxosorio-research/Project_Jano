import { describe, expect, it } from "vitest";
import { presentPairState } from "./pairState";
import type { PairState } from "./project";

describe("presentPairState", () => {
  it("gives every pair state both an icon and readable text", () => {
    const states: PairState[] = [
      "paired",
      "missing-original",
      "missing-translation",
      "unavailable",
      "manually-linked",
      "conflict",
    ];

    for (const state of states) {
      expect(presentPairState(state).icon).not.toBe("");
      expect(presentPairState(state).label).not.toBe("");
    }
  });
});
