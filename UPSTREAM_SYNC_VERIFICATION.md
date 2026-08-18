# Upstream Functional Sync Verification Report

Date: 2026-08-18

## Integration coordinates

- Integration branch: `integration/upstream-17.3.7-functional`
- Fork baseline: `35e16aee87` plus local project configuration baseline `9a8742f491`
- Common ancestor: `ffd53ff92a6f575d499730475a73460dd7cc2eea`
- Fixed upstream snapshot: `8500092296621a6826b7136e840f8a59ea338958`
- Main branch was not advanced. This report was prepared on the isolated integration branch before the user-authorized `v20.1.7` publication.

## Policy audit

- Preserved `@dude1wudv/*` package names and bumped the fork release line from `20.1.6` to `20.1.7` only after the functional integration was complete.
- Preserved fork release scripts/workflows and Windows publishing behavior.
- Restored pure upstream documentation, changelog, and release-CI changes to the fork baseline.
- Kept `release.md` outside the integration worktree and commits.
- No added diff lines contain `@oh-my-pi/` package imports or upstream version `17.3.7` in package/Cargo/lock metadata.
- `UPSTREAM_SYNC_MANIFEST.md` reviews all 203 non-merge commits in the fixed range and records the batch, decision, reason, and conflict result; 83 merge commits are explicitly excluded as replay units.

## Conflict reconciliation highlights

- `pi-ai` / `pi-catalog`: combined retry, stream, provider, xAI, GLM, discovery, auth, and model-policy changes with fork package imports. First-party xAI Responses models use the upstream `minimal..high/xhigh` policy, while non-Responses Grok routes retain the fork `low/medium/high`, default-high behavior.
- `pi-agent` / sessions: retained transient oneshot retries, compaction recovery, checkpoint/persistence fixes, and fork session/task behavior.
- Coding agent / TUI: retained upstream extension, browser, LSP, MCP, launcher, stats, and UI fixes while preserving the fork status-line/task orchestration architecture.
- Rust/native: retained functional upstream native/text/xargs changes, refreshed locks without version rollback, and made current Windows Clippy checks clean.

## Windows release-candidate gates

The user explicitly authorized a Windows-only `v20.1.7` release and requested that Linux-only failures be skipped.


- `bun install --frozen-lockfile --ignore-scripts`
- `bun run ci:check:full`
- `bun run lint`
- `bun run build`
- `bun run ci:test:smoke` previously passed before the version bump; the release-candidate rerun reached the smoke path but hit the known Windows temporary Bun executable lookup (`ENOENT`), unrelated to the integrated source.
- `bun test --parallel=2 --timeout=30000` in `packages/agent`: 487 passed.
- `bun test --parallel=2 --timeout=30000` in `packages/catalog`: 590 passed.
- Focused xAI/catalog conflict suite: 65 passed.
- `cargo check -p pi-natives --locked`
- `cargo metadata --locked --format-version 1`

## Non-green gates and evidence

### `bun run ci:test:full`

The integration-specific catalog failures initially found by this gate were fixed and the focused catalog suite is green. The rerun stops on pre-existing Windows-only failures in unchanged `packages/utils` tests:

- POSIX path/mode assertions in `browsers.test.ts`.
- logger default-directory timing in `logger-contract.test.ts`.
- `Bun.stdout.write`/stderr-capture behavior in `ptree-stderr.test.ts`.

Running the same unchanged files on fork `main` (`35e16aee87`) reproduces the same 12 failures. Therefore this Windows host cannot provide a green full TS gate without changing baseline, unrelated platform tests.

Additional focused package evidence:

- `packages/ai`: 5 Windows baseline failures (mode `0600` and Windows `credential_process` quoting); the same two files reproduce all 5 failures on `main`.
- `packages/tui`: terminal-emulator regression failures reproduce on `main` under this Windows host.
- Coding-agent runtime partition: unchanged plan fixture assumptions, Windows `EBUSY` temp cleanup, and one 600-second MCP chunk watchdog prevent a green partition on this host.

### Rust tests

- `bun run test:rs` cannot start because `cargo-nextest` is not installed.
- Fallback `cargo test --workspace --all-targets --locked` compiles after repairing the Windows `stat` test helper, then reports 884 passing / 24 failing `pi-builtins` tests. The failures are Windows command/path/permission assumptions (for example `xargs` child command lookup, `mktemp`, `rg`, and `wc`), not compile failures in the integrated native changes.

### Python tests

- The repository script requires `python3`, which is not installed in this Windows environment.
- Available Python is 3.9: `omp-rpc` requires `typing.TypeAlias` support not present in that interpreter configuration, and `robomp` is not installed into the environment.

### Install-method tests

- `bun run ci:test:install-methods` invokes Bash through WSL, but this host has no `/bin/bash`; WSL exits before the tests start.

## Review recommendation

The branch is ready for code review and Linux CI. Required static, lint, build, smoke, catalog, agent, and native compile checks are green. The remaining non-green commands are documented host/baseline prerequisites or failures reproduced unchanged on `main`; they should be re-run in the repository's Linux CI image with `cargo-nextest`, Python 3.11+, and Bash available.
## v20.1.7 release preparation

- Updated all public `@dude1wudv/*` workspace packages, root catalog entries, Rust workspace metadata, lockfile workspace versions, and the native version sentinel to `20.1.7`.
- Re-ran `bun run ci:check:full`, `bun run lint`, `bun run build`, and focused Windows release/publish script tests successfully.
- The full release-script suite has one Linux musl-host selection test failure when executed on Windows; the Windows release binary and npm publish topology tests pass.
- `release.md` remained outside the integration worktree and is not included in the release commit.
