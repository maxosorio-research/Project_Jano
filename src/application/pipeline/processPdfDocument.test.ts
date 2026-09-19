import { describe, expect, it, vi } from "vitest";
import type { LocalTranslationRuntime } from "../ports/LocalTranslationRuntime";
import type { SourceSegment } from "../../domain/processing";
import { translateBatchWithRecovery } from "./processPdfDocument";

function segment(index: number): SourceSegment {
  return {
    segmentId: `seg_${String(index).padStart(5, "0")}`,
    page: 1,
    blockType: "paragraph",
    text: `Source ${index}`,
    extractionMethod: "native",
  };
}

function runtimeWith(
  translateSegments: LocalTranslationRuntime["translateSegments"],
): LocalTranslationRuntime {
  return {
    inspect: vi.fn(),
    runSmokeTest: vi.fn(),
    translateSegments,
    reviewSegments: vi.fn(),
  };
}

describe("translation batch recovery", () => {
  it("splits a batch when a local model drops segment identifiers", async () => {
    const translateSegments = vi.fn(
      async (_model: string, _language: string, segments: SourceSegment[]) => {
        if (segments.length > 1) {
          throw new Error("Ollama did not preserve every segment identifier.");
        }
        return {
          segments: [
            {
              segmentId: segments[0].segmentId,
              text: `Translated ${segments[0].segmentId}`,
            },
          ],
          elapsedMs: 1,
          promptTokenCount: 2,
          outputTokenCount: 3,
        };
      },
    );
    const recovery = vi.fn();

    const result = await translateBatchWithRecovery(
      runtimeWith(translateSegments),
      "translategemma:4b",
      "es",
      [segment(1), segment(2), segment(3)],
      recovery,
    );

    expect(result.segments.map((item) => item.segmentId)).toEqual([
      "seg_00001",
      "seg_00002",
      "seg_00003",
    ]);
    expect(translateSegments).toHaveBeenCalledTimes(5);
    expect(recovery).toHaveBeenCalledTimes(2);
  });

  it("retries a connection failure up to five times", async () => {
    const translateSegments = vi.fn(async () => {
      throw new Error("Ollama is not responding on 127.0.0.1:11434.");
    });

    await expect(
      translateBatchWithRecovery(
        runtimeWith(translateSegments),
        "translategemma:4b",
        "es",
        [segment(1), segment(2)],
      ),
    ).rejects.toThrow("5 reintentos");
    expect(translateSegments).toHaveBeenCalledTimes(6);
  });

  it("retries the same batch after a transient HTTP 500 failure", async () => {
    let failures = 0;
    const translateSegments = vi.fn(
      async (_model: string, _language: string, segments: SourceSegment[]) => {
        if (failures < 2) {
          failures += 1;
          throw new Error("Ollama rechazó la traducción (HTTP 500).");
        }
        return {
          segments: segments.map((segment) => ({
            segmentId: segment.segmentId,
            text: `Translated ${segment.segmentId}`,
          })),
          elapsedMs: 1,
          promptTokenCount: null,
          outputTokenCount: null,
        };
      },
    );

    const result = await translateBatchWithRecovery(
      runtimeWith(translateSegments),
      "translategemma:4b",
      "es",
      [segment(1), segment(2)],
    );

    expect(result.segments).toHaveLength(2);
    expect(translateSegments).toHaveBeenCalledTimes(3);
  });

  it("caps invalid single-fragment output at five retries", async () => {
    const translateSegments = vi.fn(async () => {
      throw new Error("Ollama returned invalid translation JSON.");
    });

    await expect(
      translateBatchWithRecovery(
        runtimeWith(translateSegments),
        "translategemma:4b",
        "es",
        [segment(86)],
      ),
    ).rejects.toThrow("5 reintentos");
    expect(translateSegments).toHaveBeenCalledTimes(6);
  });
});
