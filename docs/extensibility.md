# Extensibility

Extensibility is Fluidity's main wedge: bring your own agent harness, CLI, review loop, or project tool into a durable Workspace.

Core stays small. Extensions contribute workflow-specific capability through declared Extension Points.

## v1 scope

v1 Extensions are **manifest-only** packages. They do not execute extension code.

A v1 `fluidity.extension.json` can contribute command-backed Integration Tiles rendered as Tool Tiles through the Terminal Session Runtime.

Schema source of truth: [`schemas/fluidity-extension.v1.schema.json`](schemas/fluidity-extension.v1.schema.json).  
Copyable examples: [`examples/extensions/`](examples/extensions/).

## Extension sources

- **Core Extension Pack**: bundled first-party Extension, identity `fluidity.core`.
- **Global Extensions**: app-wide, under app data: `extensions/<extension-id>/fluidity.extension.json`.
- **Project Extensions**: Project-scoped, under Project root: `.fluidity/extensions/<extension-id>/fluidity.extension.json`.

The directory name must match the Extension Definition `id`.

## v1 manifest shape

Required:

- `schemaVersion: 1`
- `id`
- `title`
- `contributes.integrations[]`
- `contributes.integrations[].tiles[]`

Integration Tile ids are stable within their Integration. Persisted Tiles resolve by:

```text
extensionId + integrationId + integrationTileId
```

## Command rules

`command.argv` is exact argv entries.

Fluidity does not:

- split strings;
- perform implicit shell interpolation;
- expand env vars inside argv entries.

Tool processes inherit the normal resolved process environment. If shell behavior is needed, explicitly invoke a shell.

```json
{ "argv": ["pnpm", "dev"] }
```

```json
{ "argv": ["sh", "-lc", "my-tool \"$MY_ENV\""] }
```

## Resume strategies

- `none`: launch argv exactly; no Fluidity resume metadata.
- `session-id-arg`: Fluidity appends the configured arg and a stable session id, e.g. `--session-id <id>`.

## Icons

Supported:

- first-party icon key: `{ "key": "pi" }`
- relative SVG/PNG path from manifest directory: `{ "path": "icons/tool.svg" }`

Unsupported in v1: absolute paths, URLs, parent-directory traversal.

## Reload semantics

Extension Reload is manual.

Reload:

- re-reads manifests;
- updates future Tile picker entries and launches;
- preserves existing Workspace Tile State;
- does not kill running terminal sessions.

If a persisted Integration Tile no longer resolves, keep the Tile and show unavailable diagnostics.

## Future executable Extensions

Executable Extension Modules are future work.

Rules already decided:

- manifest remains required for identity, permissions, provenance, and activation declarations;
- project executable code is disabled until explicitly trusted;
- runtime modules run outside Fluidity Core;
- runtime contributions register through the same Workspace-scoped registry;
- permissions are deny-by-default where enforceable, otherwise presented honestly as full code trust.
