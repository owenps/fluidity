import { invoke } from "@tauri-apps/api/core";
import type { CurrentWorkspaceGitPatchRequest, CurrentWorkspaceGitPatchResponse } from "./types";

export function getCurrentWorkspaceGitPatch(
  request: CurrentWorkspaceGitPatchRequest = {},
): Promise<CurrentWorkspaceGitPatchResponse> {
  return invoke<CurrentWorkspaceGitPatchResponse>("workspace_git_patch_current", { request });
}
