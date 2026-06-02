import { invoke } from "@tauri-apps/api/core";
import type { ProjectAddResponse } from "./types";

export function addProject(): Promise<ProjectAddResponse> {
  return invoke<ProjectAddResponse>("project_add");
}
