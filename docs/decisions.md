# Decisions

Short decision log. Keep this file small. Expand only when a decision actively guides implementation.

## Product

- **Fluidity Core is a frugal studio foundation.** Core owns Projects, Workspaces, Tiles, Commands, Settings, persistence, safety, and Extension loading. Workflow-specific surfaces start as Extensions.
- **Stable proves the core studio loop.** Register Project → create isolated Workspace/worktree → run Terminal/Tool Tiles → add custom tool via Extension Definition → switch/discard safely.
- **Editor/browser are deferred utility surfaces.** Do not build serious replacements for VS Code, browsers, GitHub, or agent apps.

## Workspace model

- **Persist structure, not live runtime.** Persist Settings, Registered Projects, Project Settings, Open Workspaces, Workspace Stack, and Workspace Tile State. Do not persist live shell/tool/browser/editor runtime.
- **Git worktrees live in app data.** Fluidity-managed Git-backed Workspace roots live under app data by default, not beside the Project root.
- **Use an app-wide Workspace Stack.** Current Workspace is the first item in a most-recently-shown Open Workspace ordering.
- **Settings View is app-level.** Settings are not Tiles and are not part of Workspace Tile State.

## Tiles and tools

- **Tool Tiles are distinct from Terminal Tiles.** Terminal Tiles are normal shells. Tool Tiles carry external-tool identity and resume behavior.
- **Rust owns Tool Tile launch/resume.** Rust validates Workspace roots, resolves environment, assembles resume args, starts processes, and persists state.
- **Terminal-rendered first.** Prefer command-backed terminal Tool Tiles before bespoke UI/runtime work.

## Integrations and Extensions

- **Integrations are product-level tool/platform connections.** They may be bundled or Extension-contributed.
- **v1 Extensions are manifest-only.** `fluidity.extension.json` contributes command-backed Integration Tiles without executing extension code.
- **Persist Integration Tiles by contribution identity.** Use `extensionId + integrationId + integrationTileId`.
- **Extension Reload is manual.** Reload changes future contributions/launches; it does not delete Workspace Tile State or kill running terminal sessions.
- **Executable Extension Modules are future work.** Runtime behavior must be declared in the manifest, trusted explicitly, run outside Core, and register through the same Workspace-scoped registry.
