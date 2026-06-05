import { invoke } from "@tauri-apps/api/core";
import type {
  ExtensionSettingsListRequest,
  ExtensionSettingsResponse,
  IntegrationCatalogListRequest,
  IntegrationCatalogResponse,
  ToolAvailability,
  ToolAvailabilityListRequest,
} from "./types";

export function listIntegrationCatalog(
  request: IntegrationCatalogListRequest,
): Promise<IntegrationCatalogResponse> {
  return invoke<IntegrationCatalogResponse>("integration_catalog_list", { request });
}

export function listToolAvailabilities(
  request: ToolAvailabilityListRequest,
): Promise<ToolAvailability[]> {
  return invoke<ToolAvailability[]>("integration_tool_availability_list", { request });
}

export function listExtensionSettings(
  request: ExtensionSettingsListRequest,
): Promise<ExtensionSettingsResponse> {
  return invoke<ExtensionSettingsResponse>("extension_settings_list", { request });
}
