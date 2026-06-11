import { invoke } from "@tauri-apps/api/core";
import type {
  WorkspaceDiscardRequest,
  WorkspaceDiscardResponse,
  WorkspaceOverview,
  WorkspaceCreateRequest,
  WorkspaceCreateResponse,
  WorkspaceIntentCaptureRequest,
  WorkspaceIntentCaptureResponse,
  WorkspaceRenameRequest,
  WorkspaceRenameResponse,
  WorkspaceSwitchRequest,
  WorkspaceSwitchResponse,
  WorkspaceTileStateSaveRequest,
} from "./types";

export function getWorkspaceOverview(): Promise<WorkspaceOverview> {
  return invoke<WorkspaceOverview>("workspace_overview");
}

export function saveWorkspaceTileState(request: WorkspaceTileStateSaveRequest): Promise<void> {
  return invoke<void>("workspace_tile_state_save", { request });
}

export function createWorkspace(request: WorkspaceCreateRequest): Promise<WorkspaceCreateResponse> {
  return invoke<WorkspaceCreateResponse>("workspace_create", { request });
}

export function renameWorkspace(request: WorkspaceRenameRequest): Promise<WorkspaceRenameResponse> {
  return invoke<WorkspaceRenameResponse>("workspace_rename", { request });
}

export function captureWorkspaceFirstIntent(
  request: WorkspaceIntentCaptureRequest,
): Promise<WorkspaceIntentCaptureResponse> {
  return invoke<WorkspaceIntentCaptureResponse>("workspace_capture_first_intent", { request });
}

export function discardWorkspace(
  request: WorkspaceDiscardRequest,
): Promise<WorkspaceDiscardResponse> {
  return invoke<WorkspaceDiscardResponse>("workspace_discard", { request });
}

export function switchWorkspace(request: WorkspaceSwitchRequest): Promise<WorkspaceSwitchResponse> {
  return invoke<WorkspaceSwitchResponse>("workspace_switch", { request });
}
