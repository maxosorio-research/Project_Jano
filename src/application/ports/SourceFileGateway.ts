import type { ReaderDocument } from "../../domain/processing";

export interface SourceFileGateway {
  readOriginalPdf(rootPath: string, relativePath: string): Promise<ArrayBuffer>;
  readTranslationText(rootPath: string, relativePath: string): Promise<string>;
  readReaderDocument(
    rootPath: string,
    documentId: string,
  ): Promise<ReaderDocument | null>;
}
