import type { ReactNode } from "react";
import claudeLogoUrl from "./assets/claude-logo.svg";
import geminiLogoUrl from "./assets/gemini-logo.svg";
import openAiLogoUrl from "./assets/openai-logo.svg";
import opencodeLogoUrl from "./assets/opencode-logo.svg";
import piLogoUrl from "./assets/pi-logo.svg";
import type { IntegrationCatalogTile, Tile } from "./types";

export type TilePickerCatalogItem =
  | {
      id: string;
      kind: "terminal";
      title: string;
      icon: ReactNode;
    }
  | {
      id: string;
      kind: "workspace";
      title: string;
      icon: ReactNode;
    }
  | {
      id: string;
      kind: "code";
      title: string;
      icon: ReactNode;
    }
  | {
      id: string;
      kind: "tool";
      title: string;
      icon: ReactNode;
      extensionId: string;
      integrationId: string;
      integrationTileId: string;
    };

export type ConfigurableTilePickerCatalogItem = TilePickerCatalogItem & {
  defaultVisible: boolean;
};

const iconByKey: Record<string, ReactNode> = {
  claude: (
    <img className="picker-option-logo picker-option-logo-plain" src={claudeLogoUrl} alt="" />
  ),
  codex: (
    <img className="picker-option-logo picker-option-logo-openai" src={openAiLogoUrl} alt="" />
  ),
  gemini: (
    <img className="picker-option-logo picker-option-logo-plain" src={geminiLogoUrl} alt="" />
  ),
  opencode: <img className="picker-option-logo" src={opencodeLogoUrl} alt="" />,
  pi: <img className="picker-option-logo" src={piLogoUrl} alt="" />,
};

const terminalTilePickerItem = {
  id: "terminal",
  kind: "terminal",
  title: "Terminal",
  icon: <span>&gt;_</span>,
  defaultVisible: true,
} as const satisfies ConfigurableTilePickerCatalogItem;

const workspaceTilePickerItem = {
  id: "workspace",
  kind: "workspace",
  title: "Workspaces",
  icon: <span className="workspace-stack-picker-icon" />,
  defaultVisible: true,
} as const satisfies ConfigurableTilePickerCatalogItem;

const codeEditorTilePickerItem = {
  id: "code",
  kind: "code",
  title: "Code Editor",
  icon: <span className="code-editor-picker-icon" />,
  defaultVisible: true,
} as const satisfies ConfigurableTilePickerCatalogItem;

export const defaultConfigurableTilePickerItems: ConfigurableTilePickerCatalogItem[] = [
  workspaceTilePickerItem,
  codeEditorTilePickerItem,
  terminalTilePickerItem,
];

export type ConfigurableTilePickerItemId = string;
export type TilePickerVisibility = Record<ConfigurableTilePickerItemId, boolean>;

export function createConfigurableTilePickerItems(
  toolTiles: IntegrationCatalogTile[],
): ConfigurableTilePickerCatalogItem[] {
  const integrationTilePickerItems = toolTiles.map((tile) => ({
    id: integrationTilePickerItemId(tile.extensionId, tile.integrationId, tile.integrationTileId),
    kind: "tool" as const,
    title: tile.title,
    icon: iconForCatalogTile(tile),
    extensionId: tile.extensionId,
    integrationId: tile.integrationId,
    integrationTileId: tile.integrationTileId,
    defaultVisible: tile.defaultVisible,
  }));

  return [
    workspaceTilePickerItem,
    codeEditorTilePickerItem,
    ...integrationTilePickerItems,
    terminalTilePickerItem,
  ];
}

export function createDefaultTilePickerVisibility(
  items: ConfigurableTilePickerCatalogItem[] = defaultConfigurableTilePickerItems,
): TilePickerVisibility {
  return Object.fromEntries(
    items.map((item) => [item.id, item.defaultVisible]),
  ) as TilePickerVisibility;
}

export function getTilePickerItems(
  items: ConfigurableTilePickerCatalogItem[],
  visibility: TilePickerVisibility,
): TilePickerCatalogItem[] {
  return items.filter((item) => visibility[item.id] ?? item.defaultVisible);
}

export function findTilePickerItem(
  items: ConfigurableTilePickerCatalogItem[],
  itemId: string,
): TilePickerCatalogItem | undefined {
  return items.find((item) => item.id === itemId);
}

export function findTilePickerItemForTile(
  items: ConfigurableTilePickerCatalogItem[],
  tile: Tile,
): TilePickerCatalogItem {
  if (tile.kind === "terminal") return terminalTilePickerItem;
  if (tile.kind === "workspace") return workspaceTilePickerItem;
  if (tile.kind === "code") return codeEditorTilePickerItem;

  return (
    items.find(
      (item) =>
        item.kind === "tool" &&
        item.extensionId === tile.extensionId &&
        item.integrationId === tile.integrationId &&
        item.integrationTileId === tile.integrationTileId,
    ) ?? {
      id: integrationTilePickerItemId(tile.extensionId, tile.integrationId, tile.integrationTileId),
      kind: "tool",
      title: tile.title,
      icon: <span>!</span>,
      extensionId: tile.extensionId,
      integrationId: tile.integrationId,
      integrationTileId: tile.integrationTileId,
    }
  );
}

export function integrationTilePickerItemId(
  extensionId: string,
  integrationId: string,
  integrationTileId: string,
): string {
  return `${extensionId}:${integrationId}.${integrationTileId}`;
}

function iconForCatalogTile(tile: IntegrationCatalogTile): ReactNode {
  if (tile.icon?.kind === "key")
    return iconByKey[tile.icon.key] ?? textIcon(tile.icon.fallbackText);
  return textIcon(tile.icon?.fallbackText ?? tile.title.slice(0, 1));
}

function textIcon(text: string): ReactNode {
  return <span>{text.trim().slice(0, 2) || "?"}</span>;
}
