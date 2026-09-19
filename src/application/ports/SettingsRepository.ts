import type { AppSettings } from "../../domain/settings";

export interface SettingsRepository {
  load(): AppSettings;
  save(settings: AppSettings): void;
}
