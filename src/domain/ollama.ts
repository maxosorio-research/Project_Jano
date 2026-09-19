export type OllamaModel = {
  name: string;
  size: number;
  parameterSize: string | null;
  quantizationLevel: string | null;
};

export type OllamaStatus = {
  available: boolean;
  endpoint: string;
  version: string | null;
  models: OllamaModel[];
  error: string | null;
};

export type OllamaSmokeTestResult = {
  model: string;
  sourceText: string;
  translatedText: string;
  elapsedMs: number;
  promptTokenCount: number | null;
  outputTokenCount: number | null;
};
