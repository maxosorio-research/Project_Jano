import type { SettingsRepository } from "../../application/ports/SettingsRepository";
import {
  defaultAppSettings,
  normalizeAppSettings,
  type AppSettings,
} from "../../domain/settings";

const STORAGE_KEY = "jano.settings.v1";

export const browserSettingsRepository: SettingsRepository = {
  load(): AppSettings {
    try {
      const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
      return stored
        ? normalizeAppSettings(JSON.parse(stored) as unknown)
        : defaultAppSettings;
    } catch {
      return defaultAppSettings;
    }
  },

  save(settings: AppSettings) {
    globalThis.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizeAppSettings(settings)),
    );
  },
};
