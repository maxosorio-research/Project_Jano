import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        ...["cmaps", "iccs", "standard_fonts", "wasm"].map((directory) => ({
          src: `node_modules/pdfjs-dist/${directory}`,
          dest: "pdfjs",
          rename: { stripBase: 2 },
        })),
        {
          src: "node_modules/tesseract.js/dist/worker.min.js",
          dest: "ocr",
          rename: { stripBase: 3 },
        },
        {
          src: "node_modules/.pnpm/tesseract.js-core@*/node_modules/tesseract.js-core/*-lstm.wasm{,.js}",
          dest: "ocr/core",
          rename: { stripBase: 5 },
        },
        {
          src: "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
          dest: "ocr/tessdata",
          rename: { stripBase: 4 },
        },
      ],
    }),
  ],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
});
