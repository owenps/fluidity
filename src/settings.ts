import { defaultThemeId, normalizeThemeId, type ThemeId } from "./themeRegistry";
import {
  createDefaultTilePickerVisibility,
  defaultConfigurableTilePickerItems,
  type TilePickerVisibility,
} from "./tilePickerCatalog";

const terminalFontSizeMin = 10;
const terminalFontSizeMax = 24;

export interface AppSettings {
  debugLayout: boolean;
  terminalFontSize: number;
  themeId: ThemeId;
  tileHeadersVisible: boolean;
  deletionPositiveStatColors: boolean;
  tilePickerVisibility: TilePickerVisibility;
}

export function createDefaultAppSettings(debugLayout = false): AppSettings {
  return {
    debugLayout,
    terminalFontSize: 13,
    themeId: defaultThemeId,
    tileHeadersVisible: true,
    deletionPositiveStatColors: false,
    tilePickerVisibility: createDefaultTilePickerVisibility(),
  };
}

export function normalizeAppSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  const defaults = createDefaultAppSettings();
  const stored = value as
    | (Partial<AppSettings> & { codeEditorThemeId?: unknown })
    | null
    | undefined;
  return {
    debugLayout: typeof value?.debugLayout === "boolean" ? value.debugLayout : defaults.debugLayout,
    terminalFontSize:
      typeof value?.terminalFontSize === "number" && Number.isFinite(value.terminalFontSize)
        ? Math.min(terminalFontSizeMax, Math.max(terminalFontSizeMin, value.terminalFontSize))
        : defaults.terminalFontSize,
    themeId: normalizeThemeId(stored?.themeId ?? stored?.codeEditorThemeId),
    tileHeadersVisible:
      typeof value?.tileHeadersVisible === "boolean"
        ? value.tileHeadersVisible
        : defaults.tileHeadersVisible,
    deletionPositiveStatColors:
      typeof value?.deletionPositiveStatColors === "boolean"
        ? value.deletionPositiveStatColors
        : defaults.deletionPositiveStatColors,
    tilePickerVisibility: readTilePickerVisibility(
      value?.tilePickerVisibility,
      defaults.tilePickerVisibility,
    ),
  };
}

function readTilePickerVisibility(
  value: unknown,
  defaults: TilePickerVisibility,
): TilePickerVisibility {
  if (!value || typeof value !== "object") return defaults;

  const stored = value as Partial<Record<keyof TilePickerVisibility, unknown>>;
  const normalized = { ...defaults };

  for (const item of defaultConfigurableTilePickerItems) {
    const visible = stored[item.id];
    if (typeof visible === "boolean") {
      normalized[item.id] = visible;
    }
  }

  for (const [itemId, visible] of Object.entries(stored)) {
    if (typeof visible === "boolean") {
      normalized[itemId] = visible;
    }
  }

  return normalized as TilePickerVisibility;
}
