import { invoke } from "@tauri-apps/api/core";
import type { ProjectFileIndexRequest, ProjectFileIndexResponse } from "./types";

export function indexProjectFiles(
  request: ProjectFileIndexRequest,
): Promise<ProjectFileIndexResponse> {
  return invoke<ProjectFileIndexResponse>("project_file_index", { request });
}
