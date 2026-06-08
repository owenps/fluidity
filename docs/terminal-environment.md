# Terminal Environment

Terminal Tiles and terminal-rendered Tool Tiles use a Rust-owned developer environment resolver so packaged macOS builds behave like a normal terminal opened in the Workspace root.

## Behavior

When Fluidity starts a Terminal Session Runtime process, it:

1. resolves the user's shell from `$SHELL`, then macOS Directory Services, then `/bin/zsh`;
2. captures `PATH` by running the shell as a login interactive shell in the target Workspace root;
3. falls back to common macOS developer paths when shell capture fails:
   `/opt/homebrew/bin`, `/opt/homebrew/sbin`, `/usr/local/bin`, `/usr/local/sbin`, `/usr/bin`, `/bin`, `/usr/sbin`, `/sbin`;
4. launches plain Terminal Tiles as login shells;
5. launches Tool Tiles with the same resolved `SHELL` and `PATH`;
6. checks Tool Tile command availability with the same resolved environment.

This keeps packaged Fluidity builds able to find common developer tools such as `node`, `pnpm`, `cargo`, and `git` when those tools are available in the user's normal shell.

## Known seams

- Only `SHELL` and `PATH` are normalized today. Other environment variables are inherited from the packaged app process unless the launched shell config sets them.
- Tool Tiles run declared argv through the user's shell for launch/resume behavior; Extension Definitions should still avoid relying on implicit shell interpolation in argv declarations.
- A future Settings or Project Settings field may expose explicit shell/PATH overrides if users need nonstandard bootstrap behavior.
