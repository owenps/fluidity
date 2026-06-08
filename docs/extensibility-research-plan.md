# Extensibility Research Plan

This plan breaks the first Fluidity extensibility work into tracer-bullet issues. The goal is to prove that a user or agent can add a custom command-backed Integration Tile through a manifest-only Extension Definition without changing Fluidity source code.

## 1. Define the v1 Extension Definition schema

**Type:** AFK  
**Blocked by:** None

### What to build

Define the v1 `fluidity.extension.json` schema for manifest-only Extensions. The schema should cover Extension identity, `schemaVersion`, title, `contributes.integrations[]`, nested command-backed Tool Tiles, argv command shape, icon references, and resume strategies.

### Acceptance criteria

- [ ] The schema includes `schemaVersion`, Extension `id`, Extension `title`, and `contributes.integrations[]`.
- [ ] Integration Tiles are nested under their Integration.
- [ ] Tool Tile commands are argv arrays with no implicit shell interpolation or argument-level environment expansion.
- [ ] Resume strategies include at least `none` and `session-id-arg`.
- [ ] Icon support includes first-party icon keys and relative SVG/PNG icon paths with fallback behavior.
- [ ] The schema is documented with a minimal valid example.

## 2. Research and map current integration catalog seams

**Type:** AFK  
**Blocked by:** None

### What to build

Map the current bundled Integration catalog implementation and identify the Rust and TypeScript seams that need to become Extension-aware.

### Acceptance criteria

Mapped in [Integration Catalog Seams](integration-catalog-seams.md).

- [x] Document how `src/shared/integrationCatalog.json` is consumed today.
- [x] Identify the TypeScript tile picker/catalog adapter changes needed for Extension-provided contributions.
- [x] Identify the Rust launch/resume/availability validation changes needed for Extension-provided contributions.
- [x] Identify persisted Tile State migration needs for assigning existing bundled Integrations to `fluidity.core`.
- [x] Call out risks where current code assumes `integrationId + integrationTileId` is globally unique.

## 3. Design the Extension discovery and reload flow

**Type:** HITL  
**Blocked by:** Issue 16

### What to build

Design how Fluidity discovers Global Extensions and Project Extensions, scopes Project Extension contributions, and reloads Extension Definitions manually.

### Acceptance criteria

- [x] Global Extensions are discovered under Fluidity's app data directory at `extensions/<extension-id>/fluidity.extension.json`.
- [x] Project Extensions are discovered under `.fluidity/extensions/<extension-id>/fluidity.extension.json` in the Project root.
- [x] Project Extension contributions are scoped to relevant Project Workspaces rather than globally loaded from every Registered Project.
- [x] Extension Reload is a manual Command and does not watch files automatically.
- [x] Reload changes available contributions, not existing Workspace Tile State.
- [x] Existing Integration Tiles whose contribution no longer resolves show a simple unavailable/broken message.
- [x] Running terminal sessions are not killed by Extension Reload.

## 4. Prototype loading manifest-only Integration Tiles

**Type:** AFK  
**Blocked by:** Issues 1 and 2

### What to build

Build a prototype that loads `fluidity.extension.json`, merges discovered contributions with the `fluidity.core` contributions, shows a custom Tool Tile in the tile picker, and launches the configured command.

### Acceptance criteria

- [x] A valid Global Extension Definition can add a command-backed Tool Tile to the tile picker.
- [x] A valid Project Extension Definition can add a command-backed Tool Tile for that Project's Workspaces.
- [x] The custom Tool Tile launches using the configured argv command.
- [x] Invalid Extension Definitions fail gracefully and do not prevent Fluidity from loading.
- [x] Extension contribution provenance is available for debugging and unavailable-state messaging.

## 5. Persist and resolve Extension-provided Tiles safely

**Type:** AFK  
**Blocked by:** Issue 4

### What to build

Update persisted Integration Tile identity and resolution so Tiles resolve by `extensionId + integrationId + integrationTileId`, preserving Tiles even when their Extension becomes unavailable.

### Acceptance criteria

- [x] Persisted Tool Tiles store Extension identity in addition to Integration and Integration Tile identity.
- [x] Existing bundled Integration Tiles migrate to `extensionId: "fluidity.core"`.
- [x] Tiles whose Extension contribution no longer resolves are preserved in Workspace Tile State.
- [x] Unresolved Tiles render a simple unavailable/broken message instead of silently becoming terminal tiles or disappearing.
- [x] Future launches/resumes use the updated Extension Definition when the identity still resolves.

## 6. Draft the `fluidity-extensions` Skill requirements

**Type:** AFK  
**Blocked by:** Issues 16 and 18

### What to build

Define the requirements and outline for the `fluidity-extensions` Skill that teaches agents how to create, test, reload, and troubleshoot Fluidity Extensions.

### Acceptance criteria

- [x] The Skill scope is limited to Extension authoring rather than general Fluidity usage.
- [x] The Skill teaches Global Extension and Project Extension locations.
- [x] The Skill teaches the v1 Extension Definition schema with examples.
- [x] The Skill explains Integration, Integration Tile, Extension Identity, and Extension Reload terminology.
- [x] The Skill includes troubleshooting guidance for unavailable/broken Tiles.
- [x] Fluidity docs show the install command `npx skills add owenps/fluidity-extensions` and do not run it automatically.

## 7. Research executable Extension module path

**Type:** HITL  
**Blocked by:** Issues 16 and 19

### What to build

Research the future path from manifest-only Extension Definitions to executable Extension modules without committing to implementation. Focus on permissions, trust, lifecycle, reload, crash isolation, and how executable modules contribute to the same registry as manifest-only Extensions.

### Acceptance criteria

Documented in [Executable Extension Modules Research](executable-extension-modules.md).

- [x] Compare Fluidity's needs against Pi's arbitrary TypeScript extension model.
- [x] Identify which Extension Points would require executable code and which can remain manifest-only.
- [x] Propose a permission/trust model for Global Extensions and Project Extensions.
- [x] Propose reload/lifecycle semantics for executable modules.
- [x] Document how executable modules would coexist with `fluidity.extension.json` rather than replacing it.

## 8. Research active Extension Points for automation and voice control

**Type:** HITL  
**Blocked by:** Issue 24

### What to build

Research the future Active Extension Points needed for executable Fluidity Extensions, using scheduled automation, agent-driven Workspace Composition, and voice-command control as tracer examples. Voice is treated as one alternate input provider rather than a core product pillar.

### Acceptance criteria

Documented in [Active Extension Points](active-extension-points.md) and ADR [0009](adr/0009-active-extension-points-use-declared-executable-modules.md).

- [x] Identify which Active Extension Points require executable Extension modules versus manifest-only Extension Definitions.
- [x] Use scheduled automation, agent-driven Workspace Composition, and voice command control as concrete scenarios.
- [x] Define candidate Extension Points such as contributed Commands, Command handlers, schedules, alternate input providers, Workspace lifecycle contributions, Workspace Composition actions, and file actions.
- [x] Propose a permission/trust model for Global Extensions and Project Extensions.
- [x] Propose lifecycle and reload semantics for Active Extensions, including what happens to running tasks during Extension Reload.
- [x] Describe how Active Extension Points coexist with `fluidity.extension.json` and the existing contribution registry.
- [x] Document safety boundaries for Project-scoped automation so Project Extensions do not globally affect unrelated Registered Projects.
- [x] Update the extensibility docs/ADR trail with the agreed terminology and decisions.
