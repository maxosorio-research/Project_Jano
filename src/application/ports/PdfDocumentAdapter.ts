export type PdfPageDimensions = {
  width: number;
  height: number;
};

export type PdfPageVisualSummary = {
  imageCount: number;
  vectorPathCount: number;
};

export interface PdfPageRenderJob {
  finished: Promise<PdfPageDimensions>;
  cancel(): void;
}

export interface PdfDocumentHandle {
  readonly pageCount: number;
  extractPageText(pageNumber: number): Promise<string>;
  inspectPageVisuals?(pageNumber: number): Promise<PdfPageVisualSummary>;
  renderPageImage(pageNumber: number, scale: number): Promise<Blob>;
  renderPage(
    pageNumber: number,
    scale: number,
    pageContainer: HTMLElement,
    canvas: HTMLCanvasElement,
    textLayer: HTMLElement,
  ): PdfPageRenderJob;
  destroy(): Promise<void>;
}

export interface PdfDocumentAdapter {
  load(data: Uint8Array): Promise<PdfDocumentHandle>;
}
