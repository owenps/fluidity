import { useEffect, useMemo, useRef, useState } from "react";
import { APP_NAME } from "./appConstants";
import { keyboardShortcutGroups } from "./commands";
import { KeyChord } from "./KeyCap";
import { Slider } from "./Slider";
import { Toggle } from "./Toggle";
import {
  configurableTilePickerItems,
  type ConfigurableTilePickerItemId,
  type TilePickerVisibility,
} from "./tilePickerCatalog";
import type { ProjectSettings, RegisteredProject, ToolAvailability } from "./types";

const terminalFontSizeMin = 10;
const terminalFontSizeMax = 24;
const terminalFontSizeStep = 1;

type SettingsCategoryId = "general" | "appearance" | "tiles" | "keybinds";
type Destination = { kind: "category"; id: SettingsCategoryId } | { kind: "project"; id: string };
type FocusPane = "left" | "right";

const settingsCategories: { id: SettingsCategoryId; title: string }[] = [
  { id: "general", title: "General" },
  { id: "appearance", title: "Appearance" },
  { id: "tiles", title: "Tiles" },
  { id: "keybinds", title: "Keybinds" },
];

interface SettingsViewProps {
  debugLayout: boolean;
  onDebugLayoutChange: (enabled: boolean) => void;
  terminalFontSize: number;
  onTerminalFontSizeChange: (fontSize: number) => void;
  tileHeadersVisible: boolean;
  onTileHeadersVisibleChange: (visible: boolean) => void;
  deletionPositiveStatColors: boolean;
  onDeletionPositiveStatColorsChange: (enabled: boolean) => void;
  tilePickerVisibility: TilePickerVisibility;
  toolAvailabilityByPickerItemId: Map<string, ToolAvailability>;
  toolAvailabilityLoaded: boolean;
  onTilePickerVisibilityChange: (itemId: ConfigurableTilePickerItemId, visible: boolean) => void;
  onRefreshToolAvailabilities: () => void;
  projects: RegisteredProject[];
  projectsLoaded: boolean;
  onProjectSettingsChange: (projectId: string, settings: ProjectSettings) => void;
  onRemoveProject: (projectId: string) => void;
  onResetApplication: () => void;
  onClose: () => void;
  focusToken: number;
}

let lastSelectedDestinationKey = "category:general";

function destinationKey(destination: Destination): string {
  return destination.kind === "category"
    ? `category:${destination.id}`
    : `project:${destination.id}`;
}

function destinationFromKey(key: string): Destination {
  const [kind, id] = key.split(":", 2);
  return kind === "project"
    ? { kind: "project", id }
    : { kind: "category", id: id as SettingsCategoryId };
}

function projectSort(left: RegisteredProject, right: RegisteredProject) {
  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

function sortedTilePickerConfigurationItems(visibility: TilePickerVisibility) {
  return [...configurableTilePickerItems].sort((left, right) => {
    const visibilityComparison = Number(visibility[right.id]) - Number(visibility[left.id]);
    if (visibilityComparison !== 0) return visibilityComparison;

    const titleComparison = left.title.localeCompare(right.title, undefined, {
      sensitivity: "base",
    });
    if (titleComparison !== 0) return titleComparison;

    return left.id.localeCompare(right.id);
  });
}

function controlIdsForDestination(
  destination: Destination,
  project: RegisteredProject | null,
  tilePickerItems = configurableTilePickerItems,
) {
  if (destination.kind === "category") {
    if (destination.id === "general") return ["debug-layout", "reset-application"];
    if (destination.id === "appearance") return ["terminal-font-size", "workspace-stat-colors"];
    if (destination.id === "tiles") {
      return [
        "tile-headers",
        "tile-picker-refresh",
        "tile-picker-search",
        ...tilePickerItems.map((item) => `tile-picker:${item.id}`),
      ];
    }
    return keyboardShortcutGroups.flatMap((group) =>
      group.shortcuts.map((shortcut) => shortcut.id),
    );
  }

  if (!project) return [];
  return project.kind === "git"
    ? ["delete-workspace-branch-on-discard", "disconnect-project"]
    : ["disconnect-project"];
}

export function SettingsView({
  debugLayout,
  onDebugLayoutChange,
  terminalFontSize,
  onTerminalFontSizeChange,
  tileHeadersVisible,
  onTileHeadersVisibleChange,
  deletionPositiveStatColors,
  onDeletionPositiveStatColorsChange,
  tilePickerVisibility,
  toolAvailabilityByPickerItemId,
  toolAvailabilityLoaded,
  onTilePickerVisibilityChange,
  onRefreshToolAvailabilities,
  projects,
  projectsLoaded,
  onProjectSettingsChange,
  onRemoveProject,
  onResetApplication,
  onClose,
  focusToken,
}: SettingsViewProps) {
  const viewRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [focusPane, setFocusPane] = useState<FocusPane>("left");
  const [selectedDestination, setSelectedDestination] = useState<Destination>(() =>
    destinationFromKey(lastSelectedDestinationKey),
  );
  const [activeControlId, setActiveControlId] = useState("debug-layout");
  const [tilePickerQuery, setTilePickerQuery] = useState("");
  const [tilePickerDisplayItems] = useState(() =>
    sortedTilePickerConfigurationItems(tilePickerVisibility),
  );
  const [pendingReset, setPendingReset] = useState(false);
  const [pendingProjectRemovalId, setPendingProjectRemovalId] = useState<string | null>(null);

  const sortedProjects = useMemo(() => [...projects].sort(projectSort), [projects]);
  const selectedProject =
    selectedDestination.kind === "project"
      ? (sortedProjects.find((project) => project.id === selectedDestination.id) ?? null)
      : null;

  const navigationDestinations = useMemo<Destination[]>(
    () => [
      ...settingsCategories.map((category) => ({ kind: "category" as const, id: category.id })),
      ...sortedProjects.map((project) => ({ kind: "project" as const, id: project.id })),
    ],
    [sortedProjects],
  );
  const selectedDestinationKey = destinationKey(selectedDestination);
  const rightControlIds = useMemo(
    () => controlIdsForDestination(selectedDestination, selectedProject, tilePickerDisplayItems),
    [selectedDestination, selectedProject, tilePickerDisplayItems],
  );
  const visibleTilePickerItems = useMemo(() => {
    const query = tilePickerQuery.trim().toLowerCase();
    if (!query) return tilePickerDisplayItems;
    return tilePickerDisplayItems.filter((item) => item.title.toLowerCase().includes(query));
  }, [tilePickerDisplayItems, tilePickerQuery]);

  useEffect(() => {
    setFocusPane("left");
    viewRef.current?.focus();
  }, [focusToken]);

  useEffect(() => {
    lastSelectedDestinationKey = destinationKey(selectedDestination);
  }, [selectedDestination]);

  useEffect(() => {
    if (selectedDestination.kind !== "project") return;
    if (sortedProjects.some((project) => project.id === selectedDestination.id)) return;
    setSelectedDestination({ kind: "category", id: "general" });
    setFocusPane("left");
  }, [selectedDestination, sortedProjects]);

  useEffect(() => {
    const validControlIds = controlIdsForDestination(
      selectedDestination,
      selectedProject,
      tilePickerDisplayItems,
    );
    if (validControlIds.includes(activeControlId)) return;
    setActiveControlId(validControlIds[0] ?? "");
  }, [activeControlId, selectedDestination, selectedProject, tilePickerDisplayItems]);

  useEffect(() => {
    if (focusPane === "right") viewRef.current?.focus();
  }, [focusPane, activeControlId]);

  const moveLeftSelection = (delta: number) => {
    if (navigationDestinations.length === 0) return;
    const currentIndex = navigationDestinations.findIndex(
      (destination) => destinationKey(destination) === selectedDestinationKey,
    );
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + delta + navigationDestinations.length) % navigationDestinations.length;
    setSelectedDestination(navigationDestinations[nextIndex]);
    setPendingReset(false);
    setPendingProjectRemovalId(null);
  };

  const moveRightSelection = (delta: number) => {
    if (rightControlIds.length === 0) return;
    const currentIndex = rightControlIds.indexOf(activeControlId);
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + delta + rightControlIds.length) % rightControlIds.length;
    setActiveControlId(rightControlIds[nextIndex]);
  };

  const changeTerminalFontSize = (fontSize: number) => {
    onTerminalFontSizeChange(
      Math.min(terminalFontSizeMax, Math.max(terminalFontSizeMin, fontSize)),
    );
  };

  const toggleProjectBranchDiscardPolicy = () => {
    if (!selectedProject || selectedProject.kind !== "git") return;
    onProjectSettingsChange(selectedProject.id, {
      ...selectedProject.settings,
      deleteWorkspaceBranchOnDiscard: !selectedProject.settings.deleteWorkspaceBranchOnDiscard,
    });
  };

  const confirmResetApplication = () => {
    if (!pendingReset) {
      setPendingReset(true);
      return;
    }
    setPendingReset(false);
    onResetApplication();
  };

  const confirmProjectRemoval = () => {
    if (!selectedProject) return;
    if (pendingProjectRemovalId !== selectedProject.id) {
      setPendingProjectRemovalId(selectedProject.id);
      return;
    }

    const currentIndex = sortedProjects.findIndex((project) => project.id === selectedProject.id);
    const nextProject =
      sortedProjects[currentIndex + 1] ?? sortedProjects[currentIndex - 1] ?? null;
    setPendingProjectRemovalId(null);
    setSelectedDestination(
      nextProject ? { kind: "project", id: nextProject.id } : { kind: "category", id: "general" },
    );
    setFocusPane("left");
    onRemoveProject(selectedProject.id);
  };

  const activateControl = () => {
    if (activeControlId === "debug-layout") {
      onDebugLayoutChange(!debugLayout);
      return;
    }
    if (activeControlId === "workspace-stat-colors") {
      onDeletionPositiveStatColorsChange(!deletionPositiveStatColors);
      return;
    }
    if (activeControlId === "tile-headers") {
      onTileHeadersVisibleChange(!tileHeadersVisible);
      return;
    }
    if (activeControlId === "tile-picker-refresh") {
      onRefreshToolAvailabilities();
      return;
    }
    if (activeControlId === "tile-picker-search") {
      searchRef.current?.focus();
      return;
    }
    if (activeControlId.startsWith("tile-picker:")) {
      const itemId = activeControlId.slice("tile-picker:".length) as ConfigurableTilePickerItemId;
      onTilePickerVisibilityChange(itemId, !tilePickerVisibility[itemId]);
      return;
    }
    if (activeControlId === "delete-workspace-branch-on-discard") {
      toggleProjectBranchDiscardPolicy();
      return;
    }
    if (activeControlId === "disconnect-project") {
      confirmProjectRemoval();
      return;
    }
    if (activeControlId === "reset-application") {
      confirmResetApplication();
    }
  };

  const adjustControl = (delta: number) => {
    if (activeControlId === "terminal-font-size") {
      changeTerminalFontSize(terminalFontSize + delta * terminalFontSizeStep);
      return;
    }
    if (delta > 0) activateControl();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT") {
      if (event.key === "Escape") {
        event.preventDefault();
        target.blur();
        viewRef.current?.focus();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (focusPane === "left") {
      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        moveLeftSelection(1);
        return;
      }
      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        moveLeftSelection(-1);
        return;
      }
      if (event.key === "l" || event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        setFocusPane("right");
      }
      return;
    }

    if (event.key === "j" || event.key === "ArrowDown") {
      event.preventDefault();
      moveRightSelection(1);
      return;
    }
    if (event.key === "k" || event.key === "ArrowUp") {
      event.preventDefault();
      moveRightSelection(-1);
      return;
    }
    if (event.key === "h" || event.key === "ArrowLeft") {
      event.preventDefault();
      setFocusPane("left");
      return;
    }
    if (event.key === "l" || event.key === "ArrowRight") {
      event.preventDefault();
      adjustControl(1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      activateControl();
    }
  };

  const selectedTitle =
    selectedDestination.kind === "project"
      ? (selectedProject?.name ?? "Project Settings")
      : (settingsCategories.find((category) => category.id === selectedDestination.id)?.title ??
        "Settings");

  return (
    <section
      ref={viewRef}
      className="settings-view"
      aria-label="Settings"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <header className="settings-view-header" data-tauri-drag-region>
        <h1>Settings</h1>
        <button
          className="settings-close-button"
          type="button"
          onClick={onClose}
          aria-label="Close settings"
        >
          ×
        </button>
      </header>

      <div className="settings-view-content">
        <nav
          className={["settings-sidebar", focusPane === "left" ? "settings-pane-focused" : ""].join(
            " ",
          )}
          aria-label="Settings sections"
        >
          <div className="settings-sidebar-section">
            {settingsCategories.map((category) =>
              renderNavigationRow({ kind: "category", id: category.id }, category.title),
            )}
          </div>
          <div className="settings-sidebar-section">
            <div className="settings-sidebar-heading">Projects</div>
            {!projectsLoaded ? (
              <div className="settings-sidebar-empty">Loading projects…</div>
            ) : null}
            {projectsLoaded && sortedProjects.length === 0 ? (
              <div className="settings-sidebar-empty">No projects registered.</div>
            ) : null}
            {sortedProjects.map((project) =>
              renderNavigationRow({ kind: "project", id: project.id }, project.name),
            )}
          </div>
        </nav>

        <section
          className={["settings-detail", focusPane === "right" ? "settings-pane-focused" : ""].join(
            " ",
          )}
          aria-label={selectedTitle}
        >
          <header className="settings-detail-header">
            <h2>{selectedTitle}</h2>
          </header>
          {renderDetail()}
        </section>
      </div>
    </section>
  );

  function renderNavigationRow(destination: Destination, title: string) {
    const key = destinationKey(destination);
    const selected = key === selectedDestinationKey;
    return (
      <button
        key={key}
        className={[
          "settings-sidebar-row",
          selected ? "settings-sidebar-row-selected" : "",
          selected && focusPane === "left" ? "settings-sidebar-row-focused" : "",
        ].join(" ")}
        type="button"
        onClick={() => {
          setSelectedDestination(destination);
          setFocusPane("left");
          setPendingReset(false);
          setPendingProjectRemovalId(null);
          viewRef.current?.focus();
        }}
      >
        {title}
      </button>
    );
  }

  function renderDetail() {
    if (selectedDestination.kind === "project") return renderProjectDetail();
    if (selectedDestination.id === "general") return renderGeneralDetail();
    if (selectedDestination.id === "appearance") return renderAppearanceDetail();
    if (selectedDestination.id === "tiles") return renderTilesDetail();
    return renderKeybindsDetail();
  }

  function renderGeneralDetail() {
    return (
      <div className="settings-detail-body">
        {renderToggleRow({
          id: "debug-layout",
          title: "Debug mode",
          description: "Show development-only diagnostics.",
          checked: debugLayout,
          onChange: onDebugLayoutChange,
        })}
        <div className="settings-danger-zone" aria-label="Danger Zone">
          <span className="settings-section-title">Danger Zone</span>
          {renderActionRow({
            id: "reset-application",
            title: `Reset ${APP_NAME}`,
            description: `Disconnect all projects, close workspaces, remove ${APP_NAME}-managed workspace roots, and reset settings.`,
            action: pendingReset ? "Confirm reset" : "Reset",
            danger: true,
            onClick: confirmResetApplication,
          })}
        </div>
      </div>
    );
  }

  function renderAppearanceDetail() {
    return (
      <div className="settings-detail-body">
        <label
          className={[
            "settings-row",
            activeControlId === "terminal-font-size" && focusPane === "right"
              ? "settings-row-active"
              : "",
          ].join(" ")}
          onMouseEnter={() => setActiveControlId("terminal-font-size")}
          onFocus={() => setActiveControlId("terminal-font-size")}
        >
          <span className="settings-row-copy">
            <span className="settings-row-title">Terminal font size</span>
            <span className="settings-row-description">
              Adjust the font size used by terminal-rendered tiles.
            </span>
          </span>
          <span className="settings-row-control settings-slider-control">
            <Slider
              value={terminalFontSize}
              min={terminalFontSizeMin}
              max={terminalFontSizeMax}
              step={terminalFontSizeStep}
              ariaLabel="Terminal font size"
              onValueChange={changeTerminalFontSize}
            />
            <span className="settings-value">{terminalFontSize}px</span>
          </span>
        </label>
        {renderToggleRow({
          id: "workspace-stat-colors",
          title: "Deletion-positive stats",
          description: "Show deleted-line counts as positive green stats in Workspace tiles.",
          checked: deletionPositiveStatColors,
          onChange: onDeletionPositiveStatColorsChange,
        })}
      </div>
    );
  }

  function renderTilesDetail() {
    return (
      <div className="settings-detail-body settings-tiles-body">
        {renderToggleRow({
          id: "tile-headers",
          title: "Tile headers",
          description: "Show title bars on workspace tiles.",
          checked: tileHeadersVisible,
          onChange: onTileHeadersVisibleChange,
        })}
        <section
          className="settings-inline-panel settings-detail-panel settings-tile-picker-panel"
          aria-label="Tile picker settings"
        >
          <div className="settings-inline-panel-header settings-integrations-header">
            <span>Choose which tiles appear in the picker.</span>
            <button
              className={[
                "settings-integration-refresh-button",
                activeControlId === "tile-picker-refresh" && focusPane === "right"
                  ? "settings-button-active"
                  : "",
              ].join(" ")}
              type="button"
              onMouseEnter={() => setActiveControlId("tile-picker-refresh")}
              onClick={onRefreshToolAvailabilities}
            >
              Refresh
            </button>
          </div>
          <div className="picker-search-row">
            <input
              ref={searchRef}
              className={[
                "picker-search",
                activeControlId === "tile-picker-search" && focusPane === "right"
                  ? "settings-input-active"
                  : "",
              ].join(" ")}
              value={tilePickerQuery}
              placeholder="Filter tile types"
              aria-label="Filter tile types"
              onFocus={() => setActiveControlId("tile-picker-search")}
              onChange={(event) => setTilePickerQuery(event.currentTarget.value)}
            />
          </div>
          <div
            className="selector-options settings-tile-picker-options"
            role="listbox"
            aria-label="Tile picker items"
          >
            {visibleTilePickerItems.map((item) => {
              const active = activeControlId === `tile-picker:${item.id}` && focusPane === "right";
              return (
                <label
                  key={item.id}
                  className={["selector-option", active ? "selector-option-active" : ""].join(" ")}
                  onMouseEnter={() => setActiveControlId(`tile-picker:${item.id}`)}
                >
                  <span className="picker-option-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="picker-option-copy">
                    <span className="picker-option-title">{item.title}</span>
                    {availabilityDetailForItem(item) ? (
                      <span className="picker-option-detail">
                        {availabilityDetailForItem(item)}
                      </span>
                    ) : null}
                  </span>
                  <span className="settings-row-control">
                    <Toggle
                      checked={tilePickerVisibility[item.id]}
                      ariaLabel={`Show ${item.title} in tile picker`}
                      onCheckedChange={(visible) => onTilePickerVisibilityChange(item.id, visible)}
                    />
                  </span>
                </label>
              );
            })}
            {visibleTilePickerItems.length === 0 ? (
              <div className="picker-empty">No matches</div>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  function renderKeybindsDetail() {
    return (
      <div className="settings-detail-body settings-keybinds-body">
        <div className="settings-inline-panel settings-detail-panel settings-keybinds-panel">
          <div className="settings-inline-panel-header">
            Keybinds are currently fixed. Rebinding will come later.
          </div>
          <div className="keyboard-shortcut-groups">
            {keyboardShortcutGroups.map((group) => (
              <section
                className="keyboard-shortcut-group"
                key={group.title}
                aria-label={`${group.title} keybinds`}
              >
                <h3>{group.title}</h3>
                <div className="keyboard-shortcut-list">
                  {group.shortcuts.map((shortcut) => {
                    const active = activeControlId === shortcut.id && focusPane === "right";
                    return (
                      <div
                        className={[
                          "keyboard-shortcut-row",
                          active ? "keyboard-shortcut-row-active" : "",
                        ].join(" ")}
                        key={shortcut.id}
                        onMouseEnter={() => setActiveControlId(shortcut.id)}
                      >
                        <span className="keyboard-shortcut-title">{shortcut.title}</span>
                        <span className="keyboard-shortcut-chords">
                          {shortcut.keyChords.map((keys, index) => (
                            <span className="keyboard-shortcut-chord-group" key={keys.join("+")}>
                              {index > 0 ? (
                                <span
                                  className="keyboard-shortcut-chord-delimiter"
                                  aria-hidden="true"
                                >
                                  /
                                </span>
                              ) : null}
                              <KeyChord keys={keys} />
                            </span>
                          ))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderProjectDetail() {
    if (!selectedProject) {
      return <div className="settings-detail-empty">Select a Project.</div>;
    }

    return (
      <div className="settings-detail-body">
        <div className="settings-project-summary">
          <div>
            <span className="settings-project-summary-label">Name</span>
            <span className="settings-project-summary-value">{selectedProject.name}</span>
          </div>
          <div>
            <span className="settings-project-summary-label">Root</span>
            <span className="settings-project-summary-value" title={selectedProject.root}>
              {selectedProject.root}
            </span>
          </div>
          <div>
            <span className="settings-project-summary-label">Kind</span>
            <span className="settings-project-summary-value">
              {selectedProject.kind === "git" ? "Git-backed Project" : "Plain Project"}
            </span>
          </div>
          <div>
            <span className="settings-project-summary-label">Availability</span>
            <span className="settings-project-summary-value">
              {selectedProject.rootAvailable === false ? "Unavailable" : "Available"}
            </span>
          </div>
        </div>

        {selectedProject.kind === "git" ? (
          renderToggleRow({
            id: "delete-workspace-branch-on-discard",
            title: "Delete local branch when discarding workspace",
            description:
              "When enabled, discarding a git-backed Workspace also deletes its local Workspace Branch when git says it is safe. Remote branches are never deleted automatically.",
            checked: selectedProject.settings.deleteWorkspaceBranchOnDiscard,
            onChange: () => toggleProjectBranchDiscardPolicy(),
          })
        ) : (
          <div className="settings-detail-note">
            This Project is not git-backed, so Git workspace settings do not apply.
          </div>
        )}

        <div className="settings-danger-zone" aria-label="Project Danger Zone">
          <span className="settings-section-title">Danger Zone</span>
          {renderActionRow({
            id: "disconnect-project",
            title: "Disconnect Project",
            description: `Remove ${selectedProject.name} from ${APP_NAME} without deleting its Project root or branches.`,
            action:
              pendingProjectRemovalId === selectedProject.id ? "Confirm disconnect" : "Disconnect",
            danger: true,
            onClick: confirmProjectRemoval,
          })}
        </div>
      </div>
    );
  }

  function renderToggleRow(options: {
    id: string;
    title: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) {
    const active = activeControlId === options.id && focusPane === "right";
    return (
      <label
        className={["settings-row", active ? "settings-row-active" : ""].join(" ")}
        onMouseEnter={() => setActiveControlId(options.id)}
        onFocus={() => setActiveControlId(options.id)}
      >
        <span className="settings-row-copy">
          <span className="settings-row-title">{options.title}</span>
          <span className="settings-row-description">{options.description}</span>
        </span>
        <span className="settings-row-control">
          <Toggle
            checked={options.checked}
            ariaLabel={options.title}
            onCheckedChange={options.onChange}
          />
        </span>
      </label>
    );
  }

  function renderActionRow(options: {
    id: string;
    title: string;
    description: string;
    action: string;
    danger?: boolean;
    onClick: () => void;
  }) {
    const active = activeControlId === options.id && focusPane === "right";
    return (
      <button
        className={[
          "settings-row",
          "settings-button-row",
          options.danger ? "settings-danger-row" : "",
          active ? "settings-row-active" : "",
        ].join(" ")}
        type="button"
        onMouseEnter={() => setActiveControlId(options.id)}
        onFocus={() => setActiveControlId(options.id)}
        onClick={options.onClick}
      >
        <span className="settings-row-copy">
          <span className="settings-row-title">{options.title}</span>
          <span className="settings-row-description">{options.description}</span>
        </span>
        <span className="settings-row-control">
          <span className={options.danger ? "settings-danger-button" : "settings-row-action"}>
            {options.action}
          </span>
        </span>
      </button>
    );
  }

  function availabilityDetailForItem(item: (typeof configurableTilePickerItems)[number]) {
    if (item.kind !== "tool") return null;
    if (!toolAvailabilityLoaded) return "Checking availability…";

    const availability = toolAvailabilityByPickerItemId.get(item.id);
    if (availability?.status === "available") return availability.resolvedPath ?? "Available";
    if (availability?.status === "unavailable") return "Not installed";
    return "Availability unknown";
  }
}
