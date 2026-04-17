# pi-gui generic npm package resolution design

## Problem

`pi-gui` can fail to load npm-installed pi packages when launched from macOS GUI surfaces such as Dock or Finder. In that environment, the app process may not inherit the same shell `PATH` and Node/npm setup as an interactive terminal. Today, when npm package lookup fails, the pi-sdk-driver fallback path removes `npm:` package sources from runtime loading. This keeps the app alive, but it silently drops extension packages that work in `pi` CLI, which makes slash commands such as `/pi-mode` disappear in `pi-gui`.

## Goal

Make `pi-gui` resolve and load generic npm-installed pi packages reliably, with the following priority order:

1. Respect explicit `npmCommand` from settings when present.
2. Recover automatically in common GUI-launch environments without requiring user configuration.
3. Preserve the existing fallback that keeps the app usable when npm truly cannot be resolved.
4. Apply the same recovery behavior to both runtime discovery and session creation/open paths so loaded packages and session commands stay consistent.

## Non-goals

- Do not add one-off logic for `@tungthedev/pi-extensions` or any other specific package.
- Do not replace pi's package resolution model with a custom package manager implementation.
- Do not require users to rewrite `packages: ["npm:..."]` entries into filesystem paths.
- Do not add a new desktop UI flow for package configuration in this change.

## Evidence from current code

### Runtime discovery path

`packages/pi-sdk-driver/src/runtime-supervisor.ts` creates a `SettingsManager`, `DefaultPackageManager`, and `DefaultResourceLoader`. When `resourceLoader.reload()` or `packageManager.resolve()` throws a global npm lookup error, the code falls back to `createSettingsManagerWithoutNpmPackages(...)`, which strips `npm:` package sources before retrying.

### Session path

`packages/pi-sdk-driver/src/npm-package-fallback.ts` has the same pattern in `createAgentSessionWithNpmFallback(...)`: on global npm lookup failure, it builds a fallback settings manager that filters out `npm:` package sources, reloads resources, and continues without those packages.

### Product impact

`apps/desktop/src/composer-commands.ts` and `apps/desktop/src/hooks/use-slash-menu.tsx` only surface slash commands that are actually loaded into the session. If the package is dropped before session/runtime loading, extension commands never reach the composer slash menu.

## Proposed approach

Introduce a shared npm command recovery layer in `packages/pi-sdk-driver` that attempts to create a working runtime/session environment before falling back to removing npm packages.

### Resolution order

For any operation that needs package resolution:

1. Try the current/default behavior first.
2. If it fails with a global npm lookup error, inspect settings for `npmCommand`.
3. If `npmCommand` is present, rebuild the relevant settings/runtime objects with that command and retry.
4. If `npmCommand` is absent or the retry still fails, try a platform-aware list of npm command candidates.
5. If all candidates fail, keep the current fallback that strips npm packages and continue running.

This keeps explicit user intent first, automatic recovery second, and current resilience behavior last.

## Candidate discovery design

Create a helper that returns ordered npm command candidates.

### Inputs

- Current `SettingsManager`
- Current process platform
- Current process environment

### Candidate order

1. `npmCommand` from settings, if configured
2. Baseline executable names expected to work when environment is already correct:
   - macOS/Linux: `npm`
   - Windows: `npm.cmd`
3. Platform-specific well-known absolute paths

### Initial platform-specific paths

#### macOS

- `/opt/homebrew/bin/npm`
- `/opt/homebrew/opt/node/bin/npm`
- `/opt/homebrew/opt/node@22/bin/npm`
- `/opt/homebrew/opt/node@20/bin/npm`
- `/usr/local/bin/npm`

#### Linux

- `/usr/bin/npm`
- `/usr/local/bin/npm`

#### Windows

- `C:\\Program Files\\nodejs\\npm.cmd`
- `C:\\Program Files (x86)\\nodejs\\npm.cmd`

The helper should deduplicate candidates while preserving order.

### Validation behavior

A candidate is only considered successful if it can be used to complete the actual operation that previously failed, not merely if the executable exists. That means the retry must drive `resourceLoader.reload()`, `packageManager.resolve()`, or `createAgentSession(...)` successfully.

## Architecture changes

### 1. Shared npm recovery helper

Add a focused helper module in `packages/pi-sdk-driver/src/` responsible for:

- reading configured `npmCommand` from settings
- generating ordered candidate commands
- rebuilding a `SettingsManager` that uses a specific npm command
- trying operations with each candidate in turn
- collecting structured diagnostics about which candidates were attempted and why they failed

This helper should not know anything about desktop UI. Its responsibility is limited to npm command recovery for package/resource loading.

### 2. Runtime supervisor integration

Update `packages/pi-sdk-driver/src/runtime-supervisor.ts` so both of these flows use the shared recovery helper before dropping npm packages:

- `ensureContext()` during `resourceLoader.reload()`
- `resolveRuntimePaths()` during `packageManager.resolve()`

Expected behavior:

- if retry with recovered npm command succeeds, keep npm package sources enabled
- if retry fails for every candidate, preserve the current fallback behavior

### 3. Session supervisor integration

Update `packages/pi-sdk-driver/src/npm-package-fallback.ts` and the session creation/open path so session resource loading uses the same recovery helper before building the no-npm fallback settings manager.

This prevents a split-brain state where runtime discovery sees package resources but agent sessions do not, or vice versa.

### 4. Diagnostics

Improve warning output when fallback eventually strips npm packages.

Warning content should include:

- workspace/cwd path
- whether configured `npmCommand` was present
- which candidate commands were tried
- final reason the no-npm fallback was used
- suggestion to set `npmCommand` explicitly if recovery still fails

Diagnostics should stay in logs/console for this change; they do not need a new renderer UI surface.

## Detailed behavior

### When `npmCommand` is configured and valid

- The configured command wins.
- No platform heuristics should override it.
- If the configured command fails, log that explicit configuration failed, then continue to automatic candidates so the GUI can still recover when possible.

### When no `npmCommand` is configured

- Use platform-aware candidate probing.
- If one candidate succeeds, continue normally and do not drop npm packages.
- If none succeed, use the existing no-npm fallback.

### When no npm packages are configured at all

- No extra probing work should run.
- Behavior stays unchanged.

### When the error is not a global npm lookup error

- Do not run npm recovery heuristics.
- Preserve current behavior and propagate the original error path.

## Error handling

- Never crash the app solely because npm recovery candidates fail.
- Do not swallow non-npm-related package errors behind the new recovery logic.
- Keep retries bounded to a small candidate list to avoid startup stalls.
- Deduplicate retries so the same command is not attempted multiple times.

## Testing strategy

Desktop truth for this issue is the Electron live surface because the bug appears when real runtime/session loading determines whether extension commands exist in a real session.

### Automated proof

Add or adapt a live Electron spec that:

1. launches `pi-gui` with a Finder-like reduced environment
2. seeds `~/.pi/agent/settings.json`-equivalent test agent settings with `packages: ["npm:@tungthedev/pi-extensions@2.0.0-alpha.1"]`
3. avoids inheriting the full terminal PATH
4. verifies the app still loads the package
5. creates/selects a session
6. confirms `/pi-mode` appears in slash command data or UI

The spec should prove the generic npm package path, not a hardcoded product exception.

### Supporting package-level tests

If practical, add smaller unit-level tests around the candidate builder and recovery helper to cover:

- configured `npmCommand` precedence
- candidate deduplication
- platform-specific candidate lists
- no probing when there are no npm packages

These tests are secondary to the live desktop proof.

### Verification lane

- iterate with a targeted live spec
- rerun `pnpm --filter @pi-gui/desktop run test:e2e:live` before closing

## File-level plan direction

Expected primary files:

- Modify: `packages/pi-sdk-driver/src/runtime-supervisor.ts`
- Modify: `packages/pi-sdk-driver/src/npm-package-fallback.ts`
- Possibly modify: `packages/pi-sdk-driver/src/runtime-deps.ts` or related settings construction helpers if needed for injected npm command behavior
- Create: a new shared helper under `packages/pi-sdk-driver/src/` for npm recovery logic
- Add tests under the nearest existing test surface for `pi-sdk-driver` if available
- Modify/add desktop live spec under `apps/desktop/tests/live/`

## Trade-offs and rationale

### Why not only require `npmCommand`?

That would be simpler but would not meet the UX goal of making Dock/Finder launches work without manual repair.

### Why not directly resolve global node_modules paths ourselves?

That would drift away from pi's package model and would become a heuristic-heavy parallel implementation. Reusing pi's package resolution with a recovered npm command is more faithful and maintainable.

### Why continue to keep the current no-npm fallback?

Because the app should remain usable even on systems where npm truly is unavailable or broken. The patch should improve recovery, not turn startup into a hard failure.

## Success criteria

1. `pi-gui` can load generic npm-installed pi packages when launched from a reduced-environment GUI context on macOS, without requiring manual `npmCommand` configuration in the common Homebrew case.
2. Explicit `npmCommand` remains the highest-priority configuration when present.
3. Runtime discovery and session loading behave consistently for npm-installed packages.
4. If recovery fails, the app still runs and logs a clear warning explaining why npm packages were skipped.
5. A live Electron test proves `/pi-mode` appears from an npm-installed package under a reduced environment.
