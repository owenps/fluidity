# `fluidity`

<p>
  <a href="https://github.com/owenps/fluidity/actions/workflows/checks.yml"><img src="https://github.com/owenps/fluidity/actions/workflows/checks.yml/badge.svg" alt="Lint and Check" /></a> &nbsp;
  <a href="https://github.com/owenps/fluidity/tags"><img src="https://img.shields.io/github/v/tag/owenps/fluidity?label=release&sort=semver" alt="Latest release tag" /></a>
</p>

A local-first, extensible development studio for parallel human + agent software work.

`fluidity` exists to make isolated workspaces, terminals, agents, and task-specific tools composable without hard-coding one workflow or provider.

Currently available only for <a href="https://www.apple.com/macos/"><kbd><img src="https://cdn.simpleicons.org/apple/white" width="16" valign="middle" /> macOS</kbd></a>.&nbsp;

## Stack

<p>
  <a href="https://tauri.app/"><kbd><img src="https://cdn.simpleicons.org/tauri" width="16" valign="middle" /> Tauri</kbd></a> &nbsp;
  <a href="https://www.rust-lang.org/"><kbd><img src="https://cdn.simpleicons.org/rust/DEA584" width="16" valign="middle" /> Rust</kbd></a> &nbsp;
  <a href="https://react.dev/"><kbd><img src="https://cdn.simpleicons.org/react" width="16" valign="middle" /> React</kbd></a> &nbsp;
  <a href="https://www.typescriptlang.org/"><kbd><img src="https://cdn.simpleicons.org/typescript" width="16" valign="middle" /> TypeScript</kbd></a> &nbsp;
</p>

## Core Features

* **Native Git Worktree Support 𖣂** — Every stream of work gets an isolated Workspace/worktree.
* **Composable Tile Workspaces ⊞** — Terminals, Tool Tiles, and future Integration Tiles share one persistent Workspace Grid.
* **Bring-Your-Own Tools ⟡** — Add custom agent/tool Tiles through Extension Definitions instead of changing Fluidity source.
* **Keyboard-First Navigation ⚡︎** — Fast Workspace switching, tile focus, and command-driven workflows.
* **Frugal Core** — Fluidity Core owns lifecycle, persistence, safety, and extension loading; workflow-specific surfaces belong in Extensions.

See [Product Thesis](docs/product-thesis.md) for the current direction.

## Showcase

> [!NOTE]
> Coming soon w/ stable release! ⸜(˶˃ ᵕ ˂˶)⸝

## Installation

> [!IMPORTANT]
> Stable release coming soon! (˶ᵔ ᵕ ᵔ˶)

## Development

```sh
pnpm install
pnpm tauri dev
```

Useful checks:

```sh
pnpm build
pnpm lint
pnpm format:check
cd src-tauri && cargo check && cargo fmt --check && cargo clippy -- -D warnings
```

Requires Rust/Cargo and the Tauri system dependencies for macOS.

See [Terminal Environment](docs/terminal-environment.md) for packaged macOS Terminal Tile and Tool Tile environment behavior.
