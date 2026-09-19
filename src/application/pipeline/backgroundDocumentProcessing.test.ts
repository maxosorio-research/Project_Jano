import { describe, expect, it } from "vitest";
import {
  backgroundJobForDocument,
  backgroundProcessingReducer,
  type BackgroundProcessingJobs,
} from "./backgroundDocumentProcessing";

describe("background document processing state", () => {
  it("keeps progress attached to its document while another document is active", () => {
    let jobs: BackgroundProcessingJobs = {};
    jobs = backgroundProcessingReducer(jobs, {
      type: "started",
      projectId: "project-a",
      documentId: "document-a",
    });
    jobs = backgroundProcessingReducer(jobs, {
      type: "progressed",
      projectId: "project-a",
      documentId: "document-a",
      progress: {
        stage: "translating",
        current: 3,
        total: 10,
        message: "Traduciendo bloque 3 de 10",
      },
    });

    expect(
      backgroundJobForDocument(jobs, "project-a", "document-a"),
    ).toMatchObject({
      phase: "running",
      progress: { current: 3, total: 10 },
    });
    expect(
      backgroundJobForDocument(jobs, "project-a", "document-b"),
    ).toBeNull();
  });

  it("removes a completed job so the persisted pair state becomes authoritative", () => {
    let jobs = backgroundProcessingReducer(
      {},
      {
        type: "started" as const,
        projectId: "project-a",
        documentId: "document-a",
      },
    );
    jobs = backgroundProcessingReducer(jobs, {
      type: "finished",
      projectId: "project-a",
      documentId: "document-a",
    });

    expect(jobs).toEqual({});
  });

  it("retains a failure on the affected document for a later retry", () => {
    const jobs = backgroundProcessingReducer(
      {},
      {
        type: "failed",
        projectId: "project-a",
        documentId: "document-a",
        error: "No se pudo traducir.",
      },
    );

    expect(
      backgroundJobForDocument(jobs, "project-a", "document-a"),
    ).toMatchObject({ phase: "failed", error: "No se pudo traducir." });
  });
});
