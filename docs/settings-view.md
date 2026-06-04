# Settings View

The Settings View is a full-page app-level surface for changing Settings and Project Settings. It is not a Workspace Tile and is not persisted in Workspace Tile State.

## Layout

The Settings View uses a two-panel layout:

- Left panel: Settings Categories followed by a Projects section.
- Right panel: details for the selected Settings Category or selected Project.

Opening Settings defaults to General unless a destination was selected earlier in the same app session. The selected destination is not persisted across app restarts. Opening Settings while it is already open is idempotent: it focuses Settings rather than closing it.

The Projects section lists existing Registered Projects by Project name in alphabetical order. Project rows show the Project name only. If there are no Registered Projects, the section remains visible with an empty state. Settings does not include Add Project.

## Settings Categories

The first Settings Categories are:

1. General
2. Appearance
3. Tiles
4. Keybinds

### General

General contains Debug mode and the global Danger Zone for Application Reset.

Application Reset returns Fluidity to its unregistered starting state: Settings return to built-in defaults, Registered Projects and their Project Settings are removed, Open Workspaces and the Workspace Stack are cleared, and Fluidity-managed workspace roots are removed subject to dirty-workspace confirmation.

### Appearance

Appearance contains visual presentation Settings:

- Terminal font size
- Deletion-positive stats

### Tiles

Tiles contains Tile-related Settings:

- Tile headers
- Tile picker configuration

### Keybinds

Keybinds is view-only for the foundation. Editing Keybinds is deferred because it requires conflict handling, persistence, and native menu accelerator coordination.

## Keyboard model

The Settings View owns keyboard input while open. Workspace and Tile shortcuts do not fire behind it.

Navigation supports both arrow keys and `h/j/k/l`:

- Left panel focused:
  - `j/k`: move selection through Settings Categories and Projects; the right panel updates immediately.
  - `l` or `Enter`: move focus into the right panel.
- Right panel focused:
  - `j/k`: move between controls and actions.
  - `h`: return focus to the left panel.
  - `l` or right arrow: adjust or open the focused control when applicable.
  - `Enter`: activate or toggle the focused control.
- `Esc`: exits an active text-input editing mode first. If not editing, it closes Settings.

The UI distinguishes selected destination from focused panel/control. When the right panel is focused, the selected left-panel row remains visibly selected but less prominent than active focus.

## Persistence

Settings and Project Settings are persisted in Rust-owned app-state JSON. Existing frontend `localStorage` Settings do not need migration.

Settings and Project Settings save immediately when changed. Project Settings changes affect future actions only.

## Project Settings

Selecting a Project shows its Project Settings in the right panel. The detail includes:

- Project name
- Project root
- Project kind
- root availability
- Project Settings controls
- a Project Danger Zone containing Disconnect Project

Unavailable Registered Projects remain visible so they can be inspected or disconnected.

Disconnecting a Project from Settings removes that Registered Project, closes its Open Workspaces, and removes Fluidity-managed workspace roots without deleting the Project root or local or remote branches. After disconnecting the selected Project, Settings selects the next Project alphabetically if one exists; otherwise it selects General.

## Workspace Branch Discard Policy

The first Project Setting is the Workspace Branch Discard Policy for Git-backed Projects.

User-facing label: **Delete local branch when discarding workspace**

Description: **When enabled, discarding a git-backed Workspace also deletes its local Workspace Branch when git says it is safe. Remote branches are never deleted automatically.**

Default: off.

When enabled, explicit Workspace discard attempts to delete the local Workspace Branch after removing the Workspace/worktree. Fluidity uses safe branch deletion only (`git branch -d`), never force deletion (`-D`), and never deletes remote branches. If git refuses because the branch is not safe to delete, Workspace discard still succeeds and Fluidity shows a warning that the branch was kept. If the branch is already gone, no warning is needed.

Branch deletion is skipped when the Project root is unavailable because Fluidity cannot safely ask git to delete the branch from the Project. Project Disconnect ignores this policy and never deletes branches.
