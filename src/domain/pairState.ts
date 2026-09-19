import type { PairState } from "./project";

export type PairStatePresentation = {
  icon: string;
  label: string;
};

const presentations: Record<PairState, PairStatePresentation> = {
  paired: { icon: "✓", label: "Complete pair" },
  "missing-original": { icon: "!", label: "Missing original" },
  "missing-translation": { icon: "!", label: "Missing translation" },
  unavailable: { icon: "↗", label: "File unavailable" },
  "manually-linked": { icon: "≠", label: "Linked after rename" },
  conflict: { icon: "⚠", label: "Pair conflict" },
};

export function presentPairState(state: PairState): PairStatePresentation {
  return presentations[state];
}
