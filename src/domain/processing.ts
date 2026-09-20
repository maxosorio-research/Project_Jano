export type ProcessingMethod = "native" | "ocr";
export type TranslationReviewStatus =
  "not-reviewed" | "approved" | "base-retained" | "needs-review";

export type MathObject = {
  mathId: string;
  segmentId: string;
  type: "inline" | "display";
  page: number;
  placeholder: string;
  source: string;
  latex: string | null;
  confidence: number;
  originalCrop: string | null;
};

export type SourceSegment = {
  segmentId: string;
  parentSegmentId?: string;
  unitOrdinal?: number;
  page: number;
  blockType:
    | "heading"
    | "paragraph"
    | "footnote"
    | "equation-marker"
    | "figure-marker"
    | "table-marker";
  text: string;
  extractionMethod: ProcessingMethod;
};

export type TranslatedSegment = {
  segmentId: string;
  parentSegmentId?: string;
  unitOrdinal?: number;
  text: string;
  baseText?: string;
  reviewedText?: string | null;
  reviewStatus?: TranslationReviewStatus;
  reviewWarnings?: string[];
};

export type Alignment = {
  alignmentId: string;
  sourceSegmentIds: string[];
  targetSegmentIds: string[];
  type: "1:1" | "1:n" | "n:1" | "n:m";
  method: string;
  confidence?: number;
};

export type ReaderDocument = {
  segments: SourceSegment[];
  translations: TranslatedSegment[];
  alignments: Alignment[];
};

export type ReviewInputSegment = {
  segmentId: string;
  sourceText: string;
  baseText: string;
};

export type TranslationBatchResult = {
  segments: TranslatedSegment[];
  elapsedMs: number;
  promptTokenCount: number | null;
  outputTokenCount: number | null;
};

export type DocumentProcessingPayload = {
  sourceText: string;
  segments: SourceSegment[];
  translations: TranslatedSegment[];
  mathObjects: MathObject[];
  markdown: string;
  metadata: {
    model: string;
    sourceLanguage: "en";
    targetLanguage: string;
    createdAt: string;
    nativePageCount: number;
    ocrPageCount: number;
    reviewLevel: "none" | "normal" | "strict";
    reviewedSegmentCount: number;
    baseRetainedSegmentCount: number;
    mathObjectCount: number;
  };
};

export type PipelineProgress = {
  stage: "extracting" | "ocr" | "translating" | "reviewing" | "saving";
  current: number;
  total: number;
  message: string;
};
