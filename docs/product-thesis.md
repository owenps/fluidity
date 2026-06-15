# Product Thesis

## Thesis

Fluidity is a **local-first, extensible development studio** for parallel human + agent software work.

It is not trying to be the best IDE, browser, GitHub client, terminal app, or agent product. It should make those tools easier to compose around one durable Project/Workspace lifecycle.

## Why it exists

Modern development work is increasingly parallel:

- multiple worktrees or branches at once;
- multiple agent runs with isolated change surfaces;
- terminals, diffs, issue context, PR feedback, browser state, and review loops scattered across apps;
- project-specific workflows that do not fit one vendor's agent/provider choices.

Fluidity is worth building only if it makes that parallel workflow feel simpler, safer, and more programmable than stitching together standalone tools.

## Core identity

Fluidity Core owns the primitives that must stay durable, safe, and boring:

1. **Projects**: local roots registered with Fluidity.
2. **Workspaces**: project-scoped working environments, usually git worktrees.
3. **Workspace Stack**: fast switching between open streams of work.
4. **Workspace Grid**: persistent tile placement and focus/navigation rules.
5. **Tiles**: durable surfaces with definitions, geometry, and resume metadata.
6. **Commands and Keybinds**: the user/action vocabulary.
7. **Settings and Project Settings**: scoped preferences and safety policies.
8. **Extension Registry**: discovery, validation, reload, provenance, and contribution identity.
9. **Safety Boundaries**: filesystem boundaries, dirty-workspace guards, process launch rules, and extension trust.

Everything else should be treated as an Integration, Core Extension Pack capability, or third-party Extension unless it is required to keep those primitives coherent.

## Product wedge

Fluidity should compete on **openness and composability**, not on matching polished feature surfaces app-for-app.

The wedge:

> Bring your own agent harness, tool, review loop, and workflow shape into a worktree-native development studio.

This is the gap left by opinionated products that have excellent worktree management but limited provider/tool extensibility.

## Frugality rules

1. **If a feature can be an Extension, it should start as an Extension.**
2. **Fluidity Core should own lifecycle, safety, persistence, and composition; Extensions should own workflow specificity.**
3. **Prefer command-backed Tool Tiles before bespoke UI.**
4. **Prefer external apps before rebuilding mature tools.**
5. **Do not build a serious code editor.** Support quick peek/light edit only if it serves Workspace review/composition.
6. **Do not build a serious browser.** Open external browser first; native Browser Tiles stay experimental.
7. **Do not build hard-coded AI provider logic beyond proving the Integration model.**
8. **Every new Core feature must explain why an Extension cannot own it.**
9. **Stable means data-safe and dogfoodable, not feature-complete.**
10. **Delete, defer, or demote surfaces that do not strengthen the core studio loop.**

## Current strategic bet

The first stable release should prove this loop:

1. Register a Project.
2. Create an isolated Git-backed Workspace/worktree.
3. Add terminal-rendered Tool Tiles, including a custom agent/tool from `fluidity.extension.json`.
4. Switch between Workspaces quickly.
5. Preserve tile state without pretending to preserve live runtimes.
6. Safely discard or keep work without data loss.

If this loop feels valuable for real work, continue. If it does not, additional editor/browser/GitHub surfaces will not save the product.

## Non-core by default

These are valuable, but should not define Fluidity Core:

- AI providers and model selection;
- agent-specific review loops;
- GitHub/GitLab/issue tracker surfaces;
- PR review/status dashboards;
- code editing beyond quick/light edits;
- browser automation and embedded browsing;
- themes and visual packs;
- custom workflow automation;
- provider-specific auth and settings.

They belong in the Core Extension Pack or Extensions once the underlying Extension Points exist.
