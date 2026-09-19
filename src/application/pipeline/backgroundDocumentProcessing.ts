import type { PipelineProgress } from "../../domain/processing";

export type BackgroundProcessingJob = {
  documentId: string;
  projectId: string;
  phase: "running" | "failed";
  progress: PipelineProgress | null;
  error: string | null;
};

export type BackgroundProcessingJobs = Record<string, BackgroundProcessingJob>;

export type BackgroundProcessingAction =
  | {
      type: "started";
      documentId: string;
      projectId: string;
    }
  | {
      type: "progressed";
      documentId: string;
      projectId: string;
      progress: PipelineProgress;
    }
  | {
      type: "failed";
      documentId: string;
      projectId: string;
      error: string;
    }
  | {
      type: "finished";
      documentId: string;
      projectId: string;
    };

export function backgroundProcessingKey(
  projectId: string,
  documentId: string,
): string {
  return `${projectId}:${documentId}`;
}

export function backgroundProcessingReducer(
  state: BackgroundProcessingJobs,
  action: BackgroundProcessingAction,
): BackgroundProcessingJobs {
  const key = backgroundProcessingKey(action.projectId, action.documentId);
  if (action.type === "finished") {
    if (!state[key]) return state;
    const next = { ...state };
    delete next[key];
    return next;
  }
  if (action.type === "started") {
    return {
      ...state,
      [key]: {
        documentId: action.documentId,
        projectId: action.projectId,
        phase: "running",
        progress: null,
        error: null,
      },
    };
  }
  if (action.type === "progressed") {
    const current = state[key];
    if (!current || current.phase !== "running") return state;
    return {
      ...state,
      [key]: { ...current, progress: action.progress },
    };
  }
  return {
    ...state,
    [key]: {
      documentId: action.documentId,
      projectId: action.projectId,
      phase: "failed",
      progress: null,
      error: action.error,
    },
  };
}

export function backgroundJobForDocument(
  jobs: BackgroundProcessingJobs,
  projectId: string | undefined,
  documentId: string | undefined,
): BackgroundProcessingJob | null {
  if (!projectId || !documentId) return null;
  return jobs[backgroundProcessingKey(projectId, documentId)] ?? null;
}
