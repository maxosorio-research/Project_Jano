import { invoke } from "@tauri-apps/api/core";
import type { SourceFileGateway } from "../../application/ports/SourceFileGateway";
import type { ReaderDocument } from "../../domain/processing";

export const tauriSourceFileGateway: SourceFileGateway = {
  readOriginalPdf(rootPath, relativePath) {
    return invoke<ArrayBuffer>("read_original_pdf", { rootPath, relativePath });
  },
  readTranslationText(rootPath, relativePath) {
    return invoke<string>("read_translation_text", { rootPath, relativePath });
  },
  readReaderDocument(rootPath, documentId) {
    return invoke<ReaderDocument | null>("read_reader_document", {
      rootPath,
      documentId,
    });
  },
};
