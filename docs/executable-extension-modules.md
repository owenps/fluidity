# Executable Extension Modules Research

Status: research direction for a future version. This document does not commit Fluidity to supporting executable Extension modules in v1.

Fluidity v1 starts with manifest-only Extension Definitions in `fluidity.extension.json`. Executable Extension modules are still a plausible future path, but they should add runtime behavior behind the same Extension identity, contribution registry, discovery, and reload model rather than replacing the declaration layer.

## Summary recommendation

Do not copy Pi's arbitrary in-process TypeScript extension model directly. Pi's model is powerful and appropriate for a terminal coding agent where installed extensions already run with the user's shell authority. Fluidity is a long-lived desktop development environment that opens untrusted Projects, preserves durable Workspace Tile State, and should keep Fluidity Core stable even when an Extension is broken.

A safer path for Fluidity is:

1. Keep `fluidity.extension.json` as the required declaration, identity, compatibility, and permission surface for every Extension.
2. Allow an optional executable module only after explicit trust and permission review.
3. Run executable modules out of process through a narrow Extension Host protocol rather than inside Fluidity Core or the renderer.
4. Require all module contributions to register into the same Workspace-scoped contribution registry used by manifest-only Extensions.
5. Preserve manual Extension Reload semantics: reload changes available contributions and future launches, not existing Workspace Tile State or running terminal sessions.

## Pi comparison

Pi extensions are TypeScript modules loaded by the agent runtime. They can register tools and commands, subscribe to lifecycle and tool events, modify context, prompt through UI APIs, persist session state, watch files, spawn commands, override built-in tools, add providers, and hot-reload with `/reload`. They may live globally or project-locally, and Pi documentation explicitly treats them as arbitrary code that runs with full system permissions.

That model gives Pi a very fast extension authoring loop:

- one TypeScript file can add a useful tool or command;
- extension code can react to rich agent lifecycle events;
- dynamic registration is natural;
- npm/git/package distribution is straightforward;
- reload is developer-friendly and can rebuild runtime state.

Fluidity should borrow the authoring ergonomics where possible, but its product constraints differ:

| Concern | Pi arbitrary TypeScript model | Fluidity need |
| --- | --- | --- |
| Trust boundary | Extension code runs with full process/user authority after installation. | Project Extensions may come from repositories. Opening a Project must not silently run repository code. |
| Process isolation | Extension failures are handled by the agent runtime, but code runs in the main runtime's authority. | A broken Extension must not crash Fluidity Core, corrupt persisted Workspace Tile State, or destabilize the renderer. |
| Permission granularity | Trust is source-based: only install trusted packages. | Fluidity needs source trust plus declared capabilities because Extensions may touch Projects, terminals, browsers, git, secrets, and workspace state. |
| Reload semantics | `/reload` tears down and recreates the extension runtime; handlers after reload must treat old state as invalid. | Extension Reload should rebuild available contributions while preserving existing Tiles and live terminal sessions. |
| Scope | Global and project-local extensions are available in the current agent context. | Project Extension contributions must be scoped per Project Workspace so two Open Workspaces can see different Project catalogs. |
| Contribution identity | Tools and commands are runtime registrations, with source metadata. | Persisted Tiles need stable contribution identities such as `extensionId + integrationId + integrationTileId` across reloads and app restarts. |
| UI lifetime | Terminal TUI extension UI is session-bound. | Fluidity Tiles are durable layout objects; custom UI must separate durable Tile State from runtime module state. |

The biggest lesson from Pi is not "run arbitrary TypeScript"; it is "make the extension API small, evented, reloadable, and easy to author." The biggest warning is that full Node/TypeScript access makes fine-grained permissions mostly advisory unless Fluidity runs code in a real sandbox or avoids exposing ambient Node capabilities.

## Extension Points by execution requirement

Manifest-only Extension Points should remain the default whenever Fluidity Core can own the behavior from static data. Executable modules should be reserved for behavior that requires logic, background work, custom rendering, dynamic discovery, or third-party protocols that Fluidity Core should not hard-code.

| Extension Point | Manifest-only is enough when... | Executable module is needed when... |
| --- | --- | --- |
| Integration Tile Contribution | The Tile launches a declared argv command through the Terminal Session Runtime, with static title/icon/resume strategy. | The Tile needs custom rendering, non-terminal runtime behavior, dynamic launch decisions, streaming data, or a custom resume provider. |
| Commands | The command invokes a built-in Fluidity command, opens a URL, creates a declared Tile, or runs a declared argv command. | The command needs arbitrary logic, external API calls, multi-step UI, mutation of Project files, or custom workflow orchestration. |
| Tile Picker metadata | Contributions are static titles, icons, categories, and default visibility. | Items appear/disappear based on runtime discovery, auth state, remote services, or Project inspection. |
| Settings contributions | Settings are declarative schema fields rendered and persisted by Fluidity Core. | Settings require validation against external services, OAuth/device flows, secret management, or custom UI. |
| Keybindings and menu items | They bind to declared Fluidity commands. | The handler is custom code or depends on runtime state. |
| Arrangement templates | The layout and startup actions are static and use supported built-in actions. | Startup requires conditional logic, remote/project inspection, or generated Tiles. |
| Themes/icons/static assets | Assets are static files referenced by the Extension Definition. | Assets are generated, remote, or depend on runtime state. |
| Git/issue/PR integrations | A built-in Fluidity adapter can be configured declaratively. | The integration talks to a new service, implements auth, polls/webhooks, computes PR review state, or provides custom issue queries. |
| Browser/workflow automation | The action is a static URL/template opened by Fluidity. | The Extension drives browser state, automates forms, injects scripts, or coordinates with external services. |
| Agent/workspace hooks | The hook can be expressed as a built-in policy option. | The Extension reacts to lifecycle events, inspects edits, gates actions, launches subagents, or injects context. |

A useful rule: if Fluidity Core can fully validate, preview, and execute the behavior from data, keep it manifest-only. If user-authored code must make decisions at runtime, require an executable module and the corresponding trust flow.

## Permission and trust model

### Trust levels

Fluidity should distinguish trust in the Extension source from permission to perform specific actions.

1. **Core Extension Pack**: first-party, signed with the app, implicitly trusted, still modeled through the same registry.
2. **Global Extension**: installed by the user for this app installation. It may be enabled globally after the user reviews its identity, source, version/hash, and requested permissions.
3. **Project Extension**: discovered under a Project root. It must be disabled by default for executable modules until the user trusts that Extension for that Project root and version/hash.
4. **Untrusted/disabled Extension**: parsed only far enough to show diagnostics and trust prompts. It contributes no executable runtime behavior.

Project Extensions deserve stricter defaults than Global Extensions because repository contents can change through checkout, pull, branch switch, or agent edits. Trust should be recorded against at least:

- Project root or Project id;
- Extension Identity;
- Extension Definition path;
- executable entrypoint path;
- content hash or package/version lock;
- requested permissions.

If the executable entrypoint, package lock, or requested permissions change, Fluidity should pause activation and ask for renewed trust. Static manifest-only contributions that do not execute during discovery may remain visible if they pass validation, but any action that starts a process should continue to show clear provenance and command details.

### Permission declarations

Executable Extensions should declare capabilities in `fluidity.extension.json`. The exact schema can evolve, but capability families should include:

- `workspace.read` and `workspace.write` with optional path globs;
- `process.spawn` with command allowlists or explicit argv declarations;
- `network` with host/domain allowlists;
- `git` operations, separated from generic process execution where possible;
- `browser` access, separated by open URL, inspect page, automate page, or inject script;
- `secrets` by named secret/provider, never ambient environment access by default;
- `terminal` creation/control;
- `workspaceState` mutations such as creating, moving, or closing Tiles;
- `background` for watchers, timers, polling, or long-running work;
- `ui.prompt` for interactive prompts and notifications;
- `agent` capabilities if future agent hooks can steer or launch agents.

Permissions should be deny-by-default for executable modules. Fluidity should show permission prompts in product language, not API names, and include provenance: Global or Project source, Extension Identity, manifest path, entrypoint, and version/hash.

### Enforcement caveat

If Fluidity loads arbitrary Node/TypeScript with full access to Node built-ins, filesystem, environment, and child processes, capability declarations cannot be strongly enforced. In that case the honest trust model is "full code trust," with permissions used only as review metadata.

For enforceable permissions, Fluidity should prefer one of these approaches before enabling untrusted or semi-trusted Project executable modules:

- a restricted Extension Host runtime that exposes only Fluidity's capability APIs;
- a sandboxed runtime such as WebAssembly, a web worker-like JS runtime without Node built-ins, or an OS sandboxed helper;
- brokered filesystem/process/network operations through Fluidity Core, with the host unable to bypass the broker;
- signed/package-pinned distribution for higher-trust Global Extensions.

Until enforcement exists, Project executable modules should require an explicit "trust this code for this Project" consent and should not auto-run from repository contents.

## Executable module lifecycle and reload

Executable modules should be supervised by Fluidity Core, but not hosted in Fluidity Core.

### Activation

Suggested startup order for a Workspace effective catalog:

1. Discover and validate `fluidity.extension.json` for the Core Extension Pack, Global Extensions, and Project Extensions relevant to the Workspace.
2. Add valid manifest-only contributions to the registry.
3. For Extensions that declare an executable module, check trust, permissions, compatibility, and activation conditions.
4. Start an Extension Host process only for approved modules that are needed for the current Workspace or requested Extension Point.
5. Let the module register runtime contributions through a typed API. Fluidity records those contributions under the manifest's Extension Identity and provenance.

Runtime modules must not choose their own Extension Identity at activation time. The identity comes from `fluidity.extension.json`, and every dynamic contribution is namespaced under that identity.

### Crash isolation

Each executable module should run in an isolated host process, or at least in a host grouped by trust/scope so one Extension cannot take down unrelated Extensions. If an Extension Host crashes or times out:

- Fluidity Core stays running;
- the registry marks runtime contributions from that module unavailable;
- durable Workspace Tile State is preserved;
- running terminal sessions launched earlier are not killed;
- custom runtime-backed Tiles show a broken/unavailable state with Extension Identity and diagnostic details;
- the user can retry via Extension Reload or disable the Extension.

### Reload

Extension Reload remains a manual command. It should not watch files and auto-run executable code after arbitrary repository edits.

A reload should:

1. Ask active hosts to deactivate, giving them a short deadline for cleanup.
2. Kill hosts that do not exit before the deadline.
3. Re-read Extension Definitions and package metadata.
4. Recompute trust if the entrypoint, hash, or requested permissions changed.
5. Rebuild manifest-only contributions.
6. Restart approved executable modules and collect runtime contributions.
7. Publish updated effective catalogs to the frontend.
8. Keep existing Workspace Tile State and live terminal sessions intact.

This mirrors Pi's lesson that code after reload should treat old runtime state as invalid, but adapts it to Fluidity's Tile model: persisted Tiles survive; runtime contributions and host-local state do not unless the Extension stores state through an approved persistence API.

### State ownership

Executable modules may need state, but Fluidity should keep durable app invariants centralized:

- Workspace Tile State remains owned by Fluidity Core.
- Extension settings/secrets are stored through Fluidity APIs, not by writing arbitrary app-state files.
- Module-local caches may be ephemeral and can be dropped on reload/crash.
- If a future custom Tile needs durable state, it should store typed Tile State through a versioned Extension API so Fluidity can preserve the Tile when the module is unavailable.

## Coexistence with `fluidity.extension.json`

Executable modules should extend the Extension Definition rather than replace it. A future schema could add optional fields such as:

```json
{
  "schemaVersion": 2,
  "id": "example.github-workflows",
  "title": "GitHub Workflows",
  "runtime": {
    "engine": "fluidity-extension-host-js",
    "entrypoint": "dist/index.js",
    "activationEvents": ["workspace.opened", "command:github.refresh"]
  },
  "permissions": {
    "network": ["api.github.com"],
    "workspace.read": [".github/**"],
    "secrets": ["github.token"],
    "background": true
  },
  "contributes": {
    "integrations": []
  }
}
```

The declaration remains responsible for:

- Extension Identity and title;
- schema and compatibility versioning;
- source/provenance and diagnostics;
- static contributions that Fluidity can render without executing code;
- requested permissions and activation events;
- icon/assets allowed by the schema;
- the executable entrypoint, if any.

The executable module is responsible only for behavior that cannot be represented statically. It can contribute dynamic capabilities through the Extension Host API, but those contributions must enter the same contribution registry and use the same provenance/error model as manifest-only contributions.

This keeps these properties intact:

- A manifest-only Extension remains valid and useful.
- The Core Extension Pack can be represented in the same model as Global and Project Extensions.
- Persisted Integration Tiles keep resolving by stable contribution identity across reloads.
- Disabled or crashed executable modules degrade to unavailable runtime contributions rather than disappearing or rewriting Workspace Tile State.
- Future schema versions can add executable support without invalidating v1 Extension authoring guidance.

## Open design questions for implementation

- Which runtime can provide enforceable capability boundaries without making authoring too hard: restricted JS, WASM, Deno-style permissions, OS sandboxed helpers, or trusted Node sidecars?
- Should Extension Hosts be per Extension, per Project, or pooled by trust level?
- How should package distribution and version pinning work for Global Extensions and Project Extensions?
- Which Extension Points need first-class activation events before executable modules are useful?
- What user-facing UI best explains Project Extension trust without training users to approve repository code blindly?
