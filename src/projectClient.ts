import { invoke } from "@tauri-apps/api/core";
import type { ProjectOpenResponse } from "./types";

export function openProject(): Promise<ProjectOpenResponse> {
  return invoke<ProjectOpenResponse>("project_open");
}
