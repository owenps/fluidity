import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceContext } from "./types";

export function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  return invoke<WorkspaceContext | null>("workspace_context");
}
