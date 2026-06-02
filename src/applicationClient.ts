import { invoke } from "@tauri-apps/api/core";

export function resetApplication(): Promise<void> {
  if (!isRunningInTauri()) return Promise.resolve();

  return invoke<void>("application_reset");
}

function isRunningInTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
