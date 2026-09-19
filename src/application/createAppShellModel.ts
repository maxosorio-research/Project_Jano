import type { PlatformRuntime } from "./ports/PlatformRuntime";

export type AppShellModel = {
  appName: "Jano";
  environmentLabel: string;
  panels: ReadonlyArray<{
    id: "project" | "original" | "translation";
    title: string;
    description: string;
  }>;
};

export function createAppShellModel(runtime: PlatformRuntime): AppShellModel {
  return {
    appName: "Jano",
    environmentLabel: runtime.environmentLabel,
    panels: [
      {
        id: "project",
        title: "Project",
        description: "Project documents will appear here.",
      },
      {
        id: "original",
        title: "Original",
        description: "The original PDF reader will appear here.",
      },
      {
        id: "translation",
        title: "Translation",
        description: "The translated reading surface will appear here.",
      },
    ],
  };
}
