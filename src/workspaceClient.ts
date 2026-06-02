import { invoke } from "@tauri-apps/api/core";
import type { CurrentWorkspaceResponse, WorkspaceTileStateSaveRequest } from "./types";

export function getCurrentWorkspace(): Promise<CurrentWorkspaceResponse | null> {
  return invoke<CurrentWorkspaceResponse | null>("workspace_current");
}

export function saveWorkspaceTileState(request: WorkspaceTileStateSaveRequest): Promise<void> {
  return invoke<void>("workspace_tile_state_save", { request });
}
