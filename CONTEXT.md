# Fluidity

Fluidity is a **local-first, extensible workspace kernel** for parallel human + agent software work.

It coordinates Projects, Workspaces, Tiles, Commands, Settings, and Extensions so task-specific workflows can be composed without hard-coding one provider, editor, browser, or review loop.

See [Product Thesis](docs/product-thesis.md).

## Product rules

- Core owns lifecycle, persistence, safety, composition, settings, and extension loading.
- Workflow-specific surfaces should start as Extensions.
- Prefer command-backed Tool Tiles before bespoke UI.
- Prefer external mature tools before rebuilding them.
- Stable means data-safe and dogfoodable, not feature-complete.

## Language

**Fluidity**: local-first, extensible desktop workspace kernel. Avoid: IDE, editor, agent app, cloud IDE, GitHub client.

**Project**: local root Fluidity registers and manages. Avoid: repository, folder, codebase.

**Git-backed Project**: Project whose root is managed by git.

**Workspace**: project-scoped working environment for one stream of work.

**Git-backed Workspace**: Workspace rooted in an isolated git worktree with a Workspace Branch.

**Non-Git Workspace**: Workspace rooted at the Project root with separate Fluidity state only.

**Open Workspace**: Workspace currently present in Fluidity, whether visible or not.

**Current Workspace**: Open Workspace currently shown.

**Workspace Stack**: app-wide most-recently-shown ordering of Open Workspaces.

**Workspace Branch**: branch checked out in a Git-backed Workspace.

**Dirty Workspace**: discardable Git-backed Workspace with uncommitted work that could be lost if its worktree is deleted.

**Tile**: movable/resizable work surface inside a Workspace.

**Workspace Grid**: Core-owned fixed-cell tile placement surface.

**Workspace Tile State**: persisted Tile definitions, geometry, and resume metadata; not live runtime state.

**Terminal Tile**: normal interactive shell rooted at the Workspace root.

**Tool Tile**: external tool/agent surface, terminal-rendered in v1.

**Integration Tile**: Tile contributed by an Integration, usually through an Extension.

**Command**: named user action invoked by keyboard or command palette.

**Settings**: global preferences.

**Project Settings**: Project-scoped overrides/policies.

**Fluidity Core**: app-owned kernel for Projects, Workspaces, Tiles, Commands, Settings, persistence, safety, and Extension loading.

**Core Extension Pack**: bundled first-party Extension package for default user-facing capabilities.

**Extension**: package contributing capabilities through supported Extension Points.

**Extension Definition**: `fluidity.extension.json`; static identity and contribution declaration.

**Extension Point**: supported contribution kind.

**Integration**: connection to an external tool/platform. May be first-party or Extension-contributed.
