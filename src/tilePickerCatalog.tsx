import type { ReactNode } from "react";
import claudeLogoUrl from "./assets/claude-logo.svg";
import geminiLogoUrl from "./assets/gemini-logo.svg";
import openAiLogoUrl from "./assets/openai-logo.svg";
import opencodeLogoUrl from "./assets/opencode-logo.svg";
import piLogoUrl from "./assets/pi-logo.svg";
import type { Tile } from "./types";

export type TilePickerCatalogItem =
  | {
      id: string;
      kind: "terminal";
      title: string;
      icon: ReactNode;
    }
  | {
      id: string;
      kind: "tool";
      title: string;
      icon: ReactNode;
      toolId: string;
    };

type ConfigurableTilePickerCatalogItem = TilePickerCatalogItem & {
  defaultVisible: boolean;
};

const terminalTilePickerItem = {
  id: "terminal",
  kind: "terminal",
  title: "Terminal",
  icon: <span>&gt;_</span>,
  defaultVisible: true,
} as const satisfies ConfigurableTilePickerCatalogItem;

export const configurableTilePickerItems = [
  {
    id: "claude",
    kind: "tool",
    title: "Claude",
    icon: (
      <img className="picker-option-logo picker-option-logo-plain" src={claudeLogoUrl} alt="" />
    ),
    toolId: "claude",
    defaultVisible: false,
  },
  {
    id: "codex",
    kind: "tool",
    title: "Codex",
    icon: (
      <img className="picker-option-logo picker-option-logo-openai" src={openAiLogoUrl} alt="" />
    ),
    toolId: "codex",
    defaultVisible: false,
  },
  {
    id: "gemini",
    kind: "tool",
    title: "Gemini",
    icon: (
      <img className="picker-option-logo picker-option-logo-plain" src={geminiLogoUrl} alt="" />
    ),
    toolId: "gemini",
    defaultVisible: false,
  },
  {
    id: "opencode",
    kind: "tool",
    title: "OpenCode",
    icon: <img className="picker-option-logo" src={opencodeLogoUrl} alt="" />,
    toolId: "opencode",
    defaultVisible: false,
  },
  {
    id: "pi",
    kind: "tool",
    title: "Pi",
    icon: <img className="picker-option-logo" src={piLogoUrl} alt="" />,
    toolId: "pi",
    defaultVisible: false,
  },
  terminalTilePickerItem,
] as const;

export type ConfigurableTilePickerItemId = (typeof configurableTilePickerItems)[number]["id"];
export type TilePickerVisibility = Record<ConfigurableTilePickerItemId, boolean>;

export function createDefaultTilePickerVisibility(): TilePickerVisibility {
  return Object.fromEntries(
    configurableTilePickerItems.map((item) => [item.id, item.defaultVisible]),
  ) as TilePickerVisibility;
}

export function getTilePickerItems(visibility: TilePickerVisibility): TilePickerCatalogItem[] {
  return configurableTilePickerItems.filter((item) => visibility[item.id]);
}

export function findTilePickerItem(itemId: string): TilePickerCatalogItem | undefined {
  return configurableTilePickerItems.find((item) => item.id === itemId);
}

export function findTilePickerItemForTile(tile: Tile): TilePickerCatalogItem {
  if (tile.kind === "terminal") return terminalTilePickerItem;

  return (
    configurableTilePickerItems.find(
      (item) => item.kind === "tool" && item.toolId === tile.toolId,
    ) ?? terminalTilePickerItem
  );
}
