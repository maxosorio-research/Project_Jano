import type { OllamaSmokeTestResult, OllamaStatus } from "../../domain/ollama";
import type {
  ReviewInputSegment,
  SourceSegment,
  TranslationBatchResult,
} from "../../domain/processing";

export interface LocalTranslationRuntime {
  inspect(): Promise<OllamaStatus>;
  runSmokeTest(
    model: string,
    targetLanguage: string,
  ): Promise<OllamaSmokeTestResult>;
  translateSegments(
    model: string,
    targetLanguage: string,
    segments: SourceSegment[],
  ): Promise<TranslationBatchResult>;
  reviewSegments(
    model: string,
    targetLanguage: string,
    reviewLevel: "normal" | "strict",
    segments: ReviewInputSegment[],
  ): Promise<TranslationBatchResult>;
}
