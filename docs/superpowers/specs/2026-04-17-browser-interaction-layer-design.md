# Browser Interaction Layer for pi-gui Design

## Goal

Add an agent-facing browser interaction layer for `pi-gui` so the app can open, focus, navigate, and later fully interact with the visible browser companion through both slash commands and natural-language routing.

This layer must preserve the Phase 1 browser architecture already in place:

- the browser companion remains the visible right-side `WebContentsView`
- browser state stays workspace-scoped
- browser automation permissions remain host-controlled and safe by default
- verbose browser steps appear in the thread timeline

## Product Summary

The browser interaction layer is not a second browser implementation. It is a command and automation layer above the existing browser companion.

The host remains the source of truth for the browser surface and its authenticated session. A default browser command/extension surface exposes those capabilities to the agent and the user. This gives `pi-gui` three complementary ways to drive the browser:

1. user clicks and types directly in the browser panel
2. user invokes explicit browser commands such as `/browser open https://example.com`
3. user writes natural language such as “mở google bằng browser companion”, which the app routes into the same browser action system

The resulting interaction must be transparent. Browser actions are not silent side effects. They appear as explicit timeline steps so the user can see what the agent is doing.

## Approved Decisions

### Integration style

- The architecture is **hybrid**.
- `pi-gui` has a **host browser bridge** as the source of truth for browser actions.
- `pi-gui` also ships a **default browser command/extension surface** above that bridge.
- Slash command support and natural-language routing are both required.

### Capability target

The target capability is **full browser control**, eventually including:

- open browser companion
- focus browser companion
- navigate to URL
- back, forward, reload
- read current page metadata and basic page state
- click
- type
- submit
- scroll
- select

### User experience

- Browser actions should support both `/browser ...` commands and natural-language instructions.
- Browser actions should produce **verbose timeline logging**, not silent state changes and not only a tiny status badge.

## Non-Goals

This design does not replace the existing browser panel architecture. It also does not introduce:

- a second hidden browser that is separate from the visible companion panel
- multi-tab browsing
- autonomous permissionless browser control by default
- a fully generic browser scripting DSL in the first pass

## Architecture Direction

### Core principle

The visible browser companion remains the only browser surface that matters. Agent automation must act on the same authenticated browser session the user can see.

The architecture is split into three layers:

1. **Host browser bridge** — the real browser action engine
2. **Default browser command surface** — slash commands and default routing affordances
3. **Intent routing layer** — maps natural language to the same host-backed browser actions

## Layer 1: Host browser bridge

### Responsibility

The host browser bridge is the source of truth for browser automation. It owns the executable actions and permission checks.

Recommended file:

- `apps/desktop/electron/browser-automation-bridge.ts`

### Responsibilities

- open and focus the browser companion
- navigate to a URL
- back, forward, reload
- query current page metadata
- later execute click, type, submit, scroll, and select actions
- enforce browser automation policy from settings
- emit browser action records for timeline display

### Relationship to existing code

The bridge sits above:

- `browser-panel-manager.ts`
- `browser-profile-registry.ts`

The bridge should not reimplement browser lifecycle. It should call the panel manager’s capabilities and orchestrate them as agent-visible actions.

### Why host-first

This keeps the browser truth in one place:

- same visible `WebContentsView`
- same workspace-scoped profile
- same permission policy
- same action log

Without this layer, extension-first automation would become difficult to debug and easy to duplicate.

## Layer 2: Default browser command surface

### Responsibility

Ship a built-in/default browser command surface that exposes browser capabilities in a way that the user and the agent can discover easily.

This can be implemented either as:

- a lightweight built-in command registry integrated into the existing command surface
- or a default extension wrapper that delegates to host browser actions

For the first iteration, the important requirement is behavioral, not branding: the command surface must be default-on and must not own independent browser state.

### Responsibilities

- expose slash commands such as `/browser open`, `/browser back`, `/browser reload`
- provide a consistent command contract that the agent can use
- delegate every real action to the host browser bridge

### Constraint

This layer must remain thin. It is a command surface, not a second automation engine.

## Layer 3: Natural-language routing

### Responsibility

Route common natural-language browser intents into the same browser action pipeline.

Examples:

- “mở google bằng browser companion”
- “open github in browser companion”
- “go back in the browser”
- “reload the current browser page”

### Direction

Natural-language routing should reuse the same internal browser action vocabulary exposed by the slash command surface.

This means the system should converge on a shared set of actions such as:

- `browser.open`
- `browser.focus`
- `browser.navigate`
- `browser.back`
- `browser.forward`
- `browser.reload`

Later, the same pattern extends to:

- `browser.click`
- `browser.type`
- `browser.submit`
- `browser.scroll`

## Verbose timeline logging

Verbose browser actions are part of the product requirement.

Every host browser action should produce a visible timeline row or structured tool-like event, for example:

- Opening browser companion
- Navigating to https://www.google.com
- Waiting for page load
- Clicking “Sign in”
- Typing into email field
- Submitting form

These rows are not merely debug output. They are a trust surface for the user.

## Permission model

The host browser bridge must respect the Phase 1 settings model:

- `ask-every-time`
- `allow-navigation-read`
- `allow-full-automation`

### First incremental rollout

The first browser interaction slice should only expose actions that are already safe under the current settings model:

- open
- focus
- navigate
- back
- forward
- reload
- read simple browser metadata

Interactive actions like click or type should be designed into the bridge API, but can be enabled in a later slice once permission prompts and action logging are fully wired.

## Implementation Slices

### Slice 1: Browser bridge primitives + slash commands

Deliver:

- host browser bridge with action primitives for open, focus, navigate, back, forward, and reload
- timeline logging for these actions
- slash/browser command surface such as `/browser open <url>`

This is the first implementation target.

### Slice 2: Natural-language routing

Deliver:

- natural-language matching for common browser intents
- routing into the same host action layer as slash commands

Examples that should work after Slice 2:

- “mở google bằng browser companion”
- “open google.com in browser companion”
- “reload the browser”

### Slice 3: Interactive browser actions

Deliver:

- click
- type
- submit
- scroll
- select
- permission prompts and full verbose logging for interaction steps

### Slice 4: Command and extension polish

Deliver:

- richer aliases
- better error messages
- stronger discoverability in slash menus and runtime command surfaces

## File Boundaries

### Host automation and browser truth

- Create: `apps/desktop/electron/browser-automation-bridge.ts`
- Modify: `apps/desktop/electron/browser-panel-manager.ts`
- Modify: `apps/desktop/electron/browser-profile-registry.ts`
- Modify: `apps/desktop/electron/main.ts`

### Renderer and shared state

- Modify: `apps/desktop/src/ipc.ts`
- Modify: `apps/desktop/electron/preload.ts`
- Modify: `apps/desktop/src/browser-panel-state.ts`
- Modify: `apps/desktop/electron/app-store.ts`

### Timeline UX

- Modify: `apps/desktop/src/timeline-types.ts`
- Modify: `apps/desktop/src/timeline-item.tsx`
- Modify: `apps/desktop/src/conversation-timeline.tsx`

### Command surface

- Modify: `apps/desktop/src/composer-commands.ts`
- Modify: `apps/desktop/src/composer-panel.tsx` only if needed for visible affordances
- Optionally create a thin built-in command registration file if command logic needs a focused home

### Tests

- Create: `apps/desktop/tests/core/browser-commands.spec.ts`
- Create later: `apps/desktop/tests/live/browser-automation.spec.ts`

## Recommended Planning Boundary

The next implementation plan should target only:

- Slice 1: host browser bridge primitives plus slash/browser command surface
- Slice 2: natural-language routing for common open/focus/navigate intents

It should not yet include click/type/submit automation unless the user explicitly wants to collapse Slice 3 into the next build.

This keeps the next phase small enough to verify quickly while still closing the key product gap the user identified: the app should be able to understand “open this in browser companion” and actually do it.

