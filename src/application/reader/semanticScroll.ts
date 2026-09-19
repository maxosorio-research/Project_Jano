import type { Alignment } from "../../domain/processing";

export type ReaderSide = "source" | "translation";

export type SegmentBounds = {
  segmentId: string;
  start: number;
  end: number;
};

export type ReaderSurfaceSnapshot = {
  scrollTop: number;
  viewportHeight: number;
  scrollHeight: number;
  segments: SegmentBounds[];
};

export interface ReaderSurfaceHandle {
  snapshot(): ReaderSurfaceSnapshot | null;
  scrollTo(scrollTop: number, behavior?: ScrollBehavior): void;
}

type AlignmentInterval = {
  leaderStart: number;
  leaderEnd: number;
  followerStart: number;
  followerEnd: number;
};

function groupBounds(
  segmentIds: string[],
  byId: Map<string, SegmentBounds>,
): { start: number; end: number } | null {
  const values = segmentIds
    .map((segmentId) => byId.get(segmentId))
    .filter((value): value is SegmentBounds => Boolean(value));
  if (!values.length) return null;
  return {
    start: Math.min(...values.map((value) => value.start)),
    end: Math.max(...values.map((value) => value.end)),
  };
}

function intervalsForDirection(
  alignments: Alignment[],
  leader: SegmentBounds[],
  follower: SegmentBounds[],
  direction: ReaderSide,
): AlignmentInterval[] {
  const leaderById = new Map(leader.map((item) => [item.segmentId, item]));
  const followerById = new Map(follower.map((item) => [item.segmentId, item]));
  return alignments
    .map((alignment) => {
      const leaderIds =
        direction === "source"
          ? alignment.sourceSegmentIds
          : alignment.targetSegmentIds;
      const followerIds =
        direction === "source"
          ? alignment.targetSegmentIds
          : alignment.sourceSegmentIds;
      const leaderBounds = groupBounds(leaderIds, leaderById);
      const followerBounds = groupBounds(followerIds, followerById);
      return leaderBounds && followerBounds
        ? {
            leaderStart: leaderBounds.start,
            leaderEnd: leaderBounds.end,
            followerStart: followerBounds.start,
            followerEnd: followerBounds.end,
          }
        : null;
    })
    .filter((value): value is AlignmentInterval => Boolean(value))
    .sort(
      (left, right) =>
        left.leaderStart - right.leaderStart ||
        left.leaderEnd - right.leaderEnd,
    );
}

function interpolate(
  value: number,
  fromStart: number,
  fromEnd: number,
  toStart: number,
  toEnd: number,
): number {
  if (fromEnd <= fromStart) return (toStart + toEnd) / 2;
  const progress = Math.min(
    1,
    Math.max(0, (value - fromStart) / (fromEnd - fromStart)),
  );
  return toStart + progress * (toEnd - toStart);
}

export function mapSemanticPosition(
  alignments: Alignment[],
  leaderSegments: SegmentBounds[],
  followerSegments: SegmentBounds[],
  leaderPosition: number,
  direction: ReaderSide,
): number | null {
  const intervals = intervalsForDirection(
    alignments,
    leaderSegments,
    followerSegments,
    direction,
  );
  if (!intervals.length) return null;

  const first = intervals[0];
  if (leaderPosition <= first.leaderStart) return first.followerStart;

  for (let index = 0; index < intervals.length; index += 1) {
    const current = intervals[index];
    if (leaderPosition <= current.leaderEnd) {
      return interpolate(
        leaderPosition,
        current.leaderStart,
        current.leaderEnd,
        current.followerStart,
        current.followerEnd,
      );
    }
    const next = intervals[index + 1];
    if (next && leaderPosition < next.leaderStart) {
      return interpolate(
        leaderPosition,
        current.leaderEnd,
        next.leaderStart,
        current.followerEnd,
        next.followerStart,
      );
    }
  }

  return intervals.at(-1)?.followerEnd ?? null;
}

export function followerScrollTop(
  mappedPosition: number,
  follower: ReaderSurfaceSnapshot,
  focusRatio = 0.35,
): number {
  const desired = mappedPosition - follower.viewportHeight * focusRatio;
  return Math.min(
    Math.max(0, follower.scrollHeight - follower.viewportHeight),
    Math.max(0, desired),
  );
}
