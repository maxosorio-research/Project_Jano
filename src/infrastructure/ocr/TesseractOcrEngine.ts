import { createWorker, OEM } from "tesseract.js";
import type { OcrEngine } from "../../application/ports/OcrEngine";

export const tesseractOcrEngine: OcrEngine = {
  async createEnglishSession(onProgress) {
    const assetBase = new URL("./ocr/", window.location.href).toString();
    const worker = await createWorker("eng", OEM.LSTM_ONLY, {
      corePath: `${assetBase}core`,
      gzip: true,
      langPath: `${assetBase}tessdata`,
      logger(message) {
        if (message.status === "recognizing text") onProgress(message.progress);
      },
      workerPath: `${assetBase}worker.min.js`,
    });
    return {
      async recognize(image) {
        const result = await worker.recognize(image);
        return result.data.text;
      },
      async terminate() {
        await worker.terminate();
      },
    };
  },
};
