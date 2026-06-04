import { invoke } from "@tauri-apps/api/core";
import { normalizeAppSettings, type AppSettings } from "./settings";
import type { ProjectSettings, RegisteredProject } from "./types";

export async function getAppSettings(): Promise<AppSettings> {
  const settings = await invoke<Partial<AppSettings>>("app_settings_get");
  return normalizeAppSettings(settings);
}

export async function updateAppSettings(settings: AppSettings): Promise<AppSettings> {
  const saved = await invoke<Partial<AppSettings>>("app_settings_update", {
    request: { settings },
  });
  return normalizeAppSettings(saved);
}

export function updateProjectSettings(
  projectId: string,
  settings: ProjectSettings,
): Promise<RegisteredProject> {
  return invoke<RegisteredProject>("project_settings_update", { request: { projectId, settings } });
}
