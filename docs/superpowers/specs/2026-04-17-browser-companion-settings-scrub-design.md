# browser companion settings scrub design

## Problem

`pi-gui` currently loads the browser companion extension through a desktop-only runtime injection path. However, the same extension can also remain in shared agent settings such as `~/.pi/agent/settings.json`. When that happens, `pi` CLI also loads it, which is not desired for this product setup.

## Goal

Ensure desktop removes the browser companion package from shared agent settings when it is present, while still loading the extension for desktop through the existing runtime-only `additionalExtensionPaths` mechanism.

## Non-goals

- Do not remove unrelated packages from shared settings.
- Do not change how generic npm or local extension packages are loaded.
- Do not remove the desktop runtime injection path.
- Do not add new renderer UI for this behavior.

## Current code facts

- `apps/desktop/electron/main.ts` already resolves `packages/pi-browser-companion-extension` and passes it into `DesktopAppStore` via `additionalExtensionPaths`.
- `packages/pi-sdk-driver` supports `additionalExtensionPaths`, so desktop can load the browser companion without storing it in agent settings.
- Production coverage already asserts that desktop should not mutate existing configured agent settings in the general case. This change intentionally creates a narrow exception for the browser companion package only.

## Proposed approach

Add a focused desktop-startup scrub step that:

1. reads the shared agent settings file used by desktop startup
2. checks `packages`
3. removes only browser companion entries
4. preserves every other setting and package entry
5. writes the file back only if a removal occurred

Desktop will continue loading the extension through `additionalExtensionPaths` after the scrub.

## Matching rules

Treat a package entry as browser companion only when it clearly points at the desktop browser companion package. Supported matches:

1. string entries whose normalized path ends at `packages/pi-browser-companion-extension`
2. string entries equal to the package name if a package-name form exists in settings
3. object entries whose `source` points at the same package

Do not use broad substring matching that could remove unrelated packages.

## Placement

Run the scrub in `apps/desktop/electron/main.ts` before `DesktopAppStore` and runtime initialization so the shared settings are cleaned before any session/runtime code reads them.

## Error handling

- If settings file does not exist, do nothing.
- If settings file is invalid JSON or unreadable, do not crash the app; skip scrub and continue startup.
- Only rewrite the file when the package list actually changes.

## Testing strategy

Add a production contract test that seeds an agent settings file containing:

- one browser companion entry
- one unrelated package entry

Then launch desktop and verify:

- browser companion entry is removed from `settings.json`
- unrelated package remains
- desktop still starts successfully

Keep the existing contract that desktop does not otherwise mutate configured settings by narrowing its expectation to this intentional scrub behavior.

## File-level plan direction

- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/tests/production/real-auth-contract.spec.ts`
- Optionally add a small helper in `apps/desktop/electron/` only if `main.ts` would become noticeably messier; otherwise keep it inline and small.

## Success criteria

1. Launching desktop removes browser companion package entries from the shared agent settings file if they are present.
2. Unrelated `packages` entries remain untouched.
3. Desktop still loads the browser companion through `additionalExtensionPaths`.
4. Automated production coverage proves the scrub behavior.
