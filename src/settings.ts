import {
  createDefaultTilePickerVisibility,
  configurableTilePickerItems,
  type TilePickerVisibility,
} from "./tilePickerCatalog";

const terminalFontSizeMin = 10;
const terminalFontSizeMax = 24;

export interface AppSettings {
  debugLayout: boolean;
  terminalFontSize: number;
  tileHeadersVisible: boolean;
  deletionPositiveStatColors: boolean;
  tilePickerVisibility: TilePickerVisibility;
}

export function createDefaultAppSettings(debugLayout = false): AppSettings {
  return {
    debugLayout,
    terminalFontSize: 13,
    tileHeadersVisible: true,
    deletionPositiveStatColors: false,
    tilePickerVisibility: createDefaultTilePickerVisibility(),
  };
}

export function normalizeAppSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  const defaults = createDefaultAppSettings();
  return {
    debugLayout: typeof value?.debugLayout === "boolean" ? value.debugLayout : defaults.debugLayout,
    terminalFontSize:
      typeof value?.terminalFontSize === "number" && Number.isFinite(value.terminalFontSize)
        ? Math.min(terminalFontSizeMax, Math.max(terminalFontSizeMin, value.terminalFontSize))
        : defaults.terminalFontSize,
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
  return Object.fromEntries(
    configurableTilePickerItems.map((item) => [
      item.id,
      typeof stored[item.id] === "boolean" ? stored[item.id] : defaults[item.id],
    ]),
  ) as TilePickerVisibility;
}
