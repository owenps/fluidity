# Fluidity

Fluidity is a local-first, extensible workspace kernel for parallel human + agent software work.

## Core concepts

- **Project**: local root Fluidity registers.
- **Workspace**: project-scoped work stream, usually an isolated git worktree.
- **Tile**: focused work surface inside a Workspace.
- **Tool Tile**: terminal-rendered external tool/agent surface.
- **Extension**: declared contribution loaded through Fluidity's extension registry.

## Product direction

Fluidity should compete on openness + composition, not all-in-one feature breadth.

Priorities:

- Fast Workspace/worktree create, switch, discard.
- Bring-your-own agent/tool harness via Extensions.
- Keyboard-first navigation.
- Durable persistence, no hidden data loss.
- Small Core: lifecycle, safety, persistence, composition, extension loading.

Frugal rule: if a feature can be an Extension, frame it as an Extension first.

Avoid: IDE, editor, GitHub client, browser app, agent app.
