import { invoke } from "@tauri-apps/api/core";
import type { LocalTranslationRuntime } from "../../application/ports/LocalTranslationRuntime";
import type { OllamaSmokeTestResult, OllamaStatus } from "../../domain/ollama";
import type {
  ReviewInputSegment,
  SourceSegment,
  TranslationBatchResult,
} from "../../domain/processing";

export const tauriOllamaRuntime: LocalTranslationRuntime = {
  inspect() {
    return invoke<OllamaStatus>("inspect_ollama");
  },

  runSmokeTest(model, targetLanguage) {
    return invoke<OllamaSmokeTestResult>("run_ollama_smoke_test", {
      model,
      targetLanguage,
    });
  },

  translateSegments(model, targetLanguage, segments: SourceSegment[]) {
    return invoke<TranslationBatchResult>("translate_segments", {
      model,
      targetLanguage,
      segments: segments.map((segment) => ({
        segmentId: segment.segmentId,
        text: segment.text,
      })),
    });
  },

  reviewSegments(
    model,
    targetLanguage,
    reviewLevel,
    segments: ReviewInputSegment[],
  ) {
    return invoke<TranslationBatchResult>("review_segments", {
      model,
      targetLanguage,
      reviewLevel,
      segments,
    });
  },
};
