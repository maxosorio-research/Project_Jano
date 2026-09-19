import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createAppShellModel } from "./application/createAppShellModel";
import { pdfJsDocumentAdapter } from "./infrastructure/pdfjs/PdfJsDocumentAdapter";
import { browserRuntime } from "./infrastructure/platform/browserRuntime";
import { browserSettingsRepository } from "./infrastructure/settings/BrowserSettingsRepository";
import { tesseractOcrEngine } from "./infrastructure/ocr/TesseractOcrEngine";
import { tauriOllamaRuntime } from "./infrastructure/tauri/TauriOllamaRuntime";
import { tauriProjectGateway } from "./infrastructure/tauri/TauriProjectGateway";
import { tauriSourceFileGateway } from "./infrastructure/tauri/TauriSourceFileGateway";
import { App } from "./ui/App";
import "./ui/styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Jano could not find its application root.");
}

const model = createAppShellModel(browserRuntime);

createRoot(root).render(
  <StrictMode>
    <App
      localTranslationRuntime={tauriOllamaRuntime}
      model={model}
      ocrEngine={tesseractOcrEngine}
      pdfDocumentAdapter={pdfJsDocumentAdapter}
      projectGateway={tauriProjectGateway}
      settingsRepository={browserSettingsRepository}
      sourceFileGateway={tauriSourceFileGateway}
    />
  </StrictMode>,
);
