import { describe, expect, it } from "vitest";
import { defaultAppSettings, normalizeAppSettings } from "./settings";

describe("normalizeAppSettings", () => {
  it("uses safe defaults for missing or invalid values", () => {
    expect(normalizeAppSettings(null)).toEqual(defaultAppSettings);
    expect(
      normalizeAppSettings({
        defaultZoom: 99,
        automaticTranslation: true,
        processingLocation: "remote",
      }),
    ).toEqual(defaultAppSettings);
  });

  it("keeps supported reader and future pipeline preferences", () => {
    expect(
      normalizeAppSettings({
        defaultZoom: 1.25,
        sidebarOpenByDefault: false,
        targetLanguage: "pt",
        ocrPolicy: "never",
        reviewLevel: "strict",
        ollamaModel: "gemma3:4b",
        librarySort: "modified-desc",
        recentProjects: [
          {
            projectId: "project-1",
            name: "Tesis",
            root: "C:/Research/Tesis",
            lastOpenedAt: "2026-09-17T12:00:00.000Z",
          },
        ],
        projectLocations: ["C:/Research"],
      }),
    ).toMatchObject({
      defaultZoom: 1.25,
      sidebarOpenByDefault: false,
      targetLanguage: "pt",
      ocrPolicy: "never",
      reviewLevel: "strict",
      automaticTranslation: false,
      processingLocation: "local-only",
      ollamaModel: "gemma3:4b",
      librarySort: "modified-desc",
      recentProjects: [
        {
          projectId: "project-1",
          name: "Tesis",
          root: "C:/Research/Tesis",
          lastOpenedAt: "2026-09-17T12:00:00.000Z",
        },
      ],
      projectLocations: ["C:/Research"],
    });
  });

  it("migrates the earlier experimental Qwen model to TranslateGemma", () => {
    expect(
      normalizeAppSettings({ ollamaModel: "qwen2.5:0.5b" }).ollamaModel,
    ).toBe("translategemma:4b");
  });
});
