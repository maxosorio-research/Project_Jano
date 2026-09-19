export type OcrPolicy = "when-needed" | "never";
export type ReviewLevel = "none" | "normal" | "strict";
export type LibrarySort =
  "name-asc" | "name-desc" | "modified-desc" | "modified-asc";

export type RecentProject = {
  projectId: string;
  name: string;
  root: string;
  lastOpenedAt: string;
};

export type AppSettings = {
  defaultZoom: number;
  sidebarOpenByDefault: boolean;
  targetLanguage: string;
  ocrPolicy: OcrPolicy;
  reviewLevel: ReviewLevel;
  automaticTranslation: boolean;
  processingLocation: "local-only";
  translationModel: string;
  reviewModel: string;
  librarySort: LibrarySort;
  recentProjects: RecentProject[];
  projectLocations: string[];
};

export const defaultAppSettings: AppSettings = {
  defaultZoom: 1,
  sidebarOpenByDefault: true,
  targetLanguage: "es",
  ocrPolicy: "when-needed",
  reviewLevel: "normal",
  automaticTranslation: false,
  processingLocation: "local-only",
  translationModel: "translategemma:12b",
  reviewModel: "qwen2.5:7b-instruct",
  librarySort: "name-asc",
  recentProjects: [],
  projectLocations: [],
};

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") {
    return defaultAppSettings;
  }
  const candidate = value as Partial<AppSettings> & { ollamaModel?: unknown };
  const legacyModel =
    typeof candidate.ollamaModel === "string" && candidate.ollamaModel !== ""
      ? candidate.ollamaModel
      : null;
  const zoomOptions = [0.5, 0.75, 1, 1.25, 1.5];
  return {
    defaultZoom: zoomOptions.includes(candidate.defaultZoom ?? 0)
      ? (candidate.defaultZoom as number)
      : defaultAppSettings.defaultZoom,
    sidebarOpenByDefault:
      typeof candidate.sidebarOpenByDefault === "boolean"
        ? candidate.sidebarOpenByDefault
        : defaultAppSettings.sidebarOpenByDefault,
    targetLanguage:
      typeof candidate.targetLanguage === "string" &&
      candidate.targetLanguage.trim() !== ""
        ? candidate.targetLanguage
        : defaultAppSettings.targetLanguage,
    ocrPolicy: candidate.ocrPolicy === "never" ? "never" : "when-needed",
    reviewLevel: isReviewLevel(candidate.reviewLevel)
      ? candidate.reviewLevel
      : defaultAppSettings.reviewLevel,
    automaticTranslation: false,
    processingLocation: "local-only",
    translationModel:
      typeof candidate.translationModel === "string" &&
      candidate.translationModel !== ""
        ? candidate.translationModel
        : defaultAppSettings.translationModel,
    reviewModel:
      typeof candidate.reviewModel === "string" && candidate.reviewModel !== ""
        ? candidate.reviewModel
        : legacyModel && !legacyModel.startsWith("translategemma:")
          ? legacyModel
          : defaultAppSettings.reviewModel,
    librarySort: isLibrarySort(candidate.librarySort)
      ? candidate.librarySort
      : defaultAppSettings.librarySort,
    recentProjects: normalizeRecentProjects(candidate.recentProjects),
    projectLocations: normalizeProjectLocations(candidate.projectLocations),
  };
}

function normalizeProjectLocations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim() !== "",
      ),
    ),
  ].slice(0, 24);
}

function isReviewLevel(value: unknown): value is ReviewLevel {
  return value === "none" || value === "normal" || value === "strict";
}

function normalizeRecentProjects(value: unknown): RecentProject[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is RecentProject => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<RecentProject>;
      return (
        typeof candidate.projectId === "string" &&
        candidate.projectId !== "" &&
        typeof candidate.name === "string" &&
        candidate.name !== "" &&
        typeof candidate.root === "string" &&
        candidate.root !== "" &&
        typeof candidate.lastOpenedAt === "string"
      );
    })
    .slice(0, 8);
}

function isLibrarySort(value: unknown): value is LibrarySort {
  return (
    value === "name-asc" ||
    value === "name-desc" ||
    value === "modified-desc" ||
    value === "modified-asc"
  );
}
