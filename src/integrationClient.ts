import { invoke } from "@tauri-apps/api/core";
import type { ToolAvailability } from "./types";

export function listToolAvailabilities(): Promise<ToolAvailability[]> {
  return invoke<ToolAvailability[]>("integration_tool_availability_list");
}
