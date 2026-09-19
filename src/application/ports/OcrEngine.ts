export interface OcrSession {
  recognize(image: Blob): Promise<string>;
  terminate(): Promise<void>;
}

export interface OcrEngine {
  createEnglishSession(
    onProgress: (progress: number) => void,
  ): Promise<OcrSession>;
}
