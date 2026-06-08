# Active Extension Points

Status: research direction for a future version. Active Extension Points are not part of the v1 manifest-only Extension Definition schema. Decision summary: [ADR 0009](adr/0009-active-extension-points-use-declared-executable-modules.md).

Active Extension Points are Extension Points that can make Fluidity do work after installation: invoke Commands, run scheduled jobs, react to Workspace lifecycle events, compose Tiles, change files, or accept alternate input such as voice through Fluidity APIs. They build on the v1 Extension Definition model rather than replacing it.

The central product direction is **Workspace Composition**, not generic desktop automation. Fluidity should expose durable Project, Workspace, Command, and Tile primitives so first-party agents and future Extensions can shape a Workspace around the user's task. Voice is only one possible input provider for invoking Commands.

## Summary recommendation

Fluidity should keep `fluidity.extension.json` as the declaration, identity, compatibility, permission, and reload surface for both passive and active Extension Points.

- Use manifest-only Extension Definitions when Fluidity Core can fully validate, preview, and execute the behavior from static data.
- Require an executable Extension module when an Extension must make runtime decisions, maintain background state, talk to external services, listen to input streams, or compose a Workspace through custom logic.
- Run executable modules outside Fluidity Core through a supervised Extension Host and require explicit trust before activating Project Extension code.
- Route every active contribution through the same Workspace-scoped contribution registry used by manifest-only Extensions.
- Keep Project Extension automation scoped to the Project that provided it; it must not run globally for unrelated Registered Projects.

## Active versus passive contributions

A passive contribution adds data that Fluidity Core owns and executes, such as a command-backed Integration Tile declared by argv. An active contribution adds behavior that can do work over time or in response to events.

| Candidate Extension Point | Manifest-only is enough when... | Executable module is required when... |
| --- | --- | --- |
| Contributed Commands | The command delegates to a built-in Fluidity Command, opens a static URL, creates a declared Tile, or runs a declared argv command through Core-owned launch rules. | The command needs custom logic, external API calls, prompts, conditional branching, file edits, Tile manipulation, or multi-step workflow orchestration. |
| Command Handlers | The handler is a built-in command target named in the Extension Definition. | The handler is Extension-authored code. Runtime handlers must be registered by the executable module under the Extension Identity. |
| Schedules | The schedule invokes a built-in Command or declared static command target with no custom runtime state. | The schedule computes what to do, polls services, inspects files, writes files, starts tools, or needs retries/state. Most useful schedules require executable modules. |
| Voice/Input Providers | Static phrase aliases map to existing Fluidity Commands and are interpreted by a Core-owned provider. | The Extension captures audio/input, performs speech-to-text, interprets intent, streams events, or provides a custom input provider. |
| Workspace Lifecycle Contributions | The Extension selects built-in policies such as default Arrangement or startup Tile set. | The Extension reacts to Workspace open/current/discard events, gates work, starts background tasks, inspects the Project, or launches agents/tools. |
| Workspace Composition Actions | The action creates, moves, focuses, or closes Tiles using static Fluidity Core-owned action descriptors. | The action chooses Tiles dynamically, renders custom UI, controls Tile runtime behavior, applies task-specific arrangements, or stores custom Tile state. |
| File Actions | The action opens a file or applies a declared template through Core. | The action reads, writes, generates, refactors, or watches Project files using custom logic. |
| Browser Actions | The action opens a static URL or URL template. | The action inspects pages, automates forms, injects scripts, or coordinates browser state with external services. |

A useful rule: if Fluidity can show the complete action to the user before execution and enforce it from data, it can be manifest-only. If user-authored code must decide what happens, it is active executable behavior.

## Scenario: scheduled automation

A scheduled automation Extension might add a daily Workspace health check:

- every weekday morning, inspect the Current Workspace or each Open Workspace for a Project;
- summarize dirty Workspaces, failing tests, or stale Workspace Branches;
- create a Browser Tile to a status page or append a note to a Project file;
- optionally start an Integration Tile for an agent to investigate.

Recommended model:

1. The Extension Definition declares schedule metadata, activation conditions, permissions, and the executable entrypoint.
2. Fluidity Core owns the schedule registry, displays upcoming jobs, and decides which Project/Workspace catalog the schedule belongs to.
3. For a manifest-only schedule, Core invokes a declared built-in Command or static argv contribution.
4. For an executable schedule, Core starts the approved Extension Host at the scheduled time and calls the registered handler with Project and Workspace context.
5. The handler may only read/write files, create Tiles, spawn tools, use network, or send notifications through permitted Fluidity APIs.

Project Extension schedules should be Project-scoped by default:

- They are loaded only for the Project that contains `.fluidity/extensions/<extension-id>/fluidity.extension.json`.
- They can run only against that Project's Workspaces unless the user grants a separate global capability to a Global Extension.
- They should not run when the Project has no Open Workspaces unless the user explicitly enables background Project automation for that Project.
- They must not enumerate or mutate unrelated Registered Projects through ambient app APIs.

## Scenario: alternate Command input, including voice

A voice-control Extension is a useful stress-test for permissions and input providers, but it is not the main product direction. The durable primitive is Command invocation. A voice-control Extension might let the user say:

- "open the git diff tile";
- "switch to the unread Workspace";
- "start Claude in this Workspace";
- "create a browser tile for the current pull request".

Recommended model:

1. Core exposes Commands as the unit of action. Voice control invokes Commands rather than directly mutating app internals.
2. Static phrase aliases can be manifest-only if a Core-owned voice/input provider already exists.
3. Custom audio capture, speech recognition, intent parsing, wake-word detection, or remote transcription require an executable module.
4. The executable module receives only the minimal context needed to interpret the request, then asks Core to invoke a Command or perform an allowed Tile/file action.
5. Dangerous actions should require confirmation, especially file writes, process spawning, browser automation, and actions outside the Current Workspace.

Voice/input providers need explicit privacy and safety permissions, such as microphone/input access, network access for transcription, Command invocation, Workspace read access for contextual interpretation, and `ui.prompt` for confirmations. The same model can support other alternate inputs without making voice a first-class product pillar.

## Scenario: agent-driven Workspace Composition

A first-party agent in the Core Extension Pack, or a future trusted Extension, might respond to a user request by shaping the Current Workspace:

- create a Browser Tile for a pull request;
- create an Integration Tile for an agent or external tool;
- open a file/code Tile at a relevant path;
- resize and move Tiles so the user can compare context;
- focus a Tile or switch to an Open Workspace that needs attention;
- apply an Arrangement as a starting point, then make task-specific changes.

Recommended model:

1. Fluidity Core owns the Workspace Grid, Tile geometry, Workspace Tile State, collision/bounds rules, and permission checks.
2. Workspace Composition happens through Commands or typed Fluidity APIs, never by directly editing persisted Workspace Tile State.
3. The Core Extension Pack can be the first trusted consumer of these APIs for agent-driven experiences.
4. Future third-party Extensions can use the same APIs when granted permissions such as `workspaceState`, `commands.invoke`, `workspace.read`, and `ui.prompt`.
5. Destructive or confusing composition changes should be explainable and undoable where practical.

## Permission and trust model

Fluidity should distinguish source trust from action permissions.

### Trust levels

- **Core Extension Pack**: first-party and bundled with Fluidity. It is implicitly trusted, but still represented in the same contribution registry.
- **Global Extension**: user-installed for this Fluidity app installation. Executable behavior may be enabled after the user reviews identity, source, version/hash, and permissions.
- **Project Extension**: discovered under a Project root. Executable behavior is disabled by default until the user trusts that Extension for that Project and version/hash.
- **Untrusted or disabled Extension**: parsed only for diagnostics and trust UI; it contributes no active behavior.

Trust for executable Project Extensions should be recorded against the Project root or Project id, Extension Identity, Extension Definition path, executable entrypoint path, package/version or content hash, and requested permissions. If any of those change, Fluidity should pause activation and ask for renewed trust.

### Permission families

Active Extensions should declare permissions in `fluidity.extension.json`; Fluidity should deny executable capabilities by default. Candidate permission families include:

- `commands.invoke` for invoking Fluidity Commands;
- `workspace.read` and `workspace.write`, optionally limited by path globs;
- `workspace.lifecycle` for receiving Workspace lifecycle events;
- `workspaceState` for creating, moving, focusing, or closing Tiles;
- `process.spawn` for starting external commands or tools;
- `terminal` for creating or writing to terminal-backed Tiles;
- `network` with host/domain allowlists;
- `browser.open`, `browser.inspect`, and `browser.automate` as separate capabilities;
- `git` operations, separated from generic process spawning where possible;
- `secrets` by named secret/provider, never ambient environment access by default;
- `background` for schedules, polling, timers, and long-running providers;
- `input.voice` or `input.audio` for voice/audio capture;
- `ui.prompt` and `notifications` for user interaction.

If an Extension Host runtime cannot technically prevent bypassing these permissions, Fluidity should present the honest model as full code trust and treat permission declarations as review metadata only. Enforceable permissions require a restricted host or brokered APIs that code cannot bypass.

## Lifecycle and reload semantics

Active Extension lifecycle should preserve Fluidity's durable Workspace model:

1. Discovery validates Extension Definitions and builds the manifest-only registry without executing Project code.
2. Activation starts only trusted executable modules whose declared activation conditions match the relevant Project/Workspace/Command/schedule/input provider.
3. Runtime contributions are registered under the manifest's Extension Identity and provenance.
4. Crash or timeout marks that module's runtime contributions unavailable without crashing Fluidity Core or deleting Workspace Tile State.
5. Extension Reload remains a manual Command and does not watch files or auto-run changed Project code.

During Extension Reload:

- Core asks active Extension Hosts to deactivate and cancels schedules/input listeners owned by the old generation.
- In-flight active tasks receive cancellation and a short cleanup deadline.
- Hosts that do not stop are killed.
- Extension Definitions are re-read, trust and permissions are rechecked, and the contribution registry is rebuilt.
- Approved executable modules may be restarted and re-register runtime contributions.
- Existing Workspace Tile State and live terminal sessions remain intact.

Changed scheduled jobs affect future firings only. Running terminal-backed Tool Tiles are not killed by reload. Runtime-backed Tiles whose handler is gone should show an unavailable state with Extension Identity and diagnostics.

## Coexistence with `fluidity.extension.json`

Active Extension Points should extend the manifest model. A future schema might add optional runtime, permissions, command, schedule, voice/input, and lifecycle declarations:

```json
{
  "schemaVersion": 2,
  "id": "example.workspace-automation",
  "title": "Workspace Automation",
  "runtime": {
    "engine": "fluidity-extension-host-js",
    "entrypoint": "dist/index.js",
    "activationEvents": [
      "command:example.workspace-automation.run-health-check",
      "schedule:example.workspace-automation.weekday-health-check",
      "input.voice"
    ]
  },
  "permissions": {
    "background": true,
    "commands.invoke": ["tiles.create", "workspaces.switch"],
    "workspace.read": ["**/*"],
    "workspace.write": ["docs/notes/**"],
    "workspaceState": ["tiles.create", "tiles.focus"],
    "network": ["api.example.com"],
    "input.voice": true,
    "ui.prompt": true
  },
  "contributes": {
    "commands": [
      {
        "id": "run-health-check",
        "title": "Run Workspace Health Check",
        "handler": "runtime"
      }
    ],
    "schedules": [
      {
        "id": "weekday-health-check",
        "title": "Weekday Workspace Health Check",
        "cron": "0 9 * * 1-5",
        "command": "example.workspace-automation.run-health-check"
      }
    ],
    "voice": {
      "phrases": [
        {
          "phrase": "run workspace health check",
          "command": "example.workspace-automation.run-health-check"
        }
      ],
      "provider": "runtime"
    },
    "integrations": []
  }
}
```

The exact schema is intentionally unsettled. The durable decisions are that the manifest remains required, the Extension Identity comes from the manifest, permissions are declared before activation, and runtime contributions flow through the same registry as passive contributions.

## Open questions

- Which Extension Host runtime can make permissions enforceable while keeping Extension authoring approachable?
- Should hosts be per Extension, per Project, or pooled by trust level and runtime engine?
- Which active tasks are allowed when a Project has no Open Workspaces?
- How should Fluidity present scheduled Project automation without training users to approve repository code blindly?
- What confirmation policy should apply when voice commands invoke destructive or cross-Workspace actions?
