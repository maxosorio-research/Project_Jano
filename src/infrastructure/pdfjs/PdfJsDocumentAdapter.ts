import {
  AnnotationMode,
  GlobalWorkerOptions,
  OPS,
  TextLayer,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type {
  PdfDocumentAdapter,
  PdfDocumentHandle,
  PdfPageRenderJob,
} from "../../application/ports/PdfDocumentAdapter";
import { reconstructPdfReadingOrder } from "./pdfReadingOrder";

GlobalWorkerOptions.workerSrc = workerUrl;

class PdfJsDocumentHandle implements PdfDocumentHandle {
  readonly pageCount: number;

  constructor(
    private readonly document: PDFDocumentProxy,
    private readonly loadingTask: PDFDocumentLoadingTask,
  ) {
    this.pageCount = document.numPages;
  }

  async extractPageText(pageNumber: number): Promise<string> {
    const page = await this.document.getPage(pageNumber);
    const content = await page.getTextContent({ includeMarkedContent: true });
    const viewport = page.getViewport({ scale: 1 });
    const items = content.items
      .map((item, sourceIndex) => ({ item, sourceIndex }))
      .filter(
        (entry): entry is { item: TextItem; sourceIndex: number } =>
          "str" in entry.item && entry.item.str.trim() !== "",
      )
      .map(({ item, sourceIndex }) => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: Math.max(item.height, 1),
        sourceIndex,
      }));
    return reconstructPdfReadingOrder(items, {
      width: viewport.width,
      height: viewport.height,
    });
  }

  async inspectPageVisuals(pageNumber: number) {
    const page = await this.document.getPage(pageNumber);
    const operators = await page.getOperatorList();
    let imageCount = 0;
    let vectorPathCount = 0;
    for (const operator of operators.fnArray) {
      if (
        operator === OPS.paintImageXObject ||
        operator === OPS.paintImageMaskXObject ||
        operator === OPS.paintInlineImageXObject
      ) {
        imageCount += 1;
      } else if (operator === OPS.constructPath) {
        vectorPathCount += 1;
      }
    }
    return { imageCount, vectorPathCount };
  }

  async renderPageImage(pageNumber: number, scale: number): Promise<Blob> {
    const page = await this.document.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = window.document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Could not prepare the OCR canvas.");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({
      annotationMode: AnnotationMode.DISABLE,
      background: "#ffffff",
      canvas,
      canvasContext: context,
      viewport,
    }).promise;
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Could not create an image for OCR.")),
        "image/png",
      );
    });
  }

  renderPage(
    pageNumber: number,
    scale: number,
    pageContainer: HTMLElement,
    canvas: HTMLCanvasElement,
    textLayerContainer: HTMLElement,
  ): PdfPageRenderJob {
    let cancelled = false;
    let canvasTask: RenderTask | undefined;
    let textLayer: TextLayer | undefined;

    const finished = (async () => {
      const page = await this.document.getPage(pageNumber);
      if (cancelled) {
        throw new Error("PDF page rendering was cancelled.");
      }

      const viewport = page.getViewport({ scale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const renderViewport = page.getViewport({ scale: scale * outputScale });

      pageContainer.style.width = `${viewport.width}px`;
      pageContainer.style.height = `${viewport.height}px`;
      pageContainer.style.setProperty("--total-scale-factor", String(scale));
      canvas.width = Math.floor(renderViewport.width);
      canvas.height = Math.floor(renderViewport.height);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      textLayerContainer.replaceChildren();
      textLayerContainer.style.width = `${viewport.width}px`;
      textLayerContainer.style.height = `${viewport.height}px`;
      textLayerContainer.style.setProperty(
        "--total-scale-factor",
        String(scale),
      );

      canvasTask = page.render({
        annotationMode: AnnotationMode.DISABLE,
        background: "#ffffff",
        canvas,
        viewport: renderViewport,
      });
      textLayer = new TextLayer({
        container: textLayerContainer,
        textContentSource: page.streamTextContent({
          includeMarkedContent: true,
        }),
        viewport,
      });

      await Promise.all([canvasTask.promise, textLayer.render()]);
      return { width: viewport.width, height: viewport.height };
    })();

    return {
      finished,
      cancel() {
        cancelled = true;
        canvasTask?.cancel();
        textLayer?.cancel();
      },
    };
  }

  destroy(): Promise<void> {
    return this.loadingTask.destroy();
  }
}

export const pdfJsDocumentAdapter: PdfDocumentAdapter = {
  async load(data) {
    const assetBase = new URL("./pdfjs/", window.location.href).toString();
    const loadingTask = getDocument({
      cMapPacked: true,
      cMapUrl: `${assetBase}cmaps/`,
      data,
      iccUrl: `${assetBase}iccs/`,
      standardFontDataUrl: `${assetBase}standard_fonts/`,
      useWorkerFetch: true,
      wasmUrl: `${assetBase}wasm/`,
    });
    const document = await loadingTask.promise;
    return new PdfJsDocumentHandle(document, loadingTask);
  },
};
