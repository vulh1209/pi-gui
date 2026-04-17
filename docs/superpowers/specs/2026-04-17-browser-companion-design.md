# Browser Companion for pi-gui Design

## Goal

Add a Codex-style browser companion to `pi-gui` as a full-height right sheet attached to the main conversation surface. The browser must support normal browsing and login flows, persist authenticated state per workspace across app restarts, and provide a clear path for future agent automation on the exact same browser session the user sees.

## Product Summary

The browser companion is a right-side browser surface for reference, login, and agent-assisted web tasks. It is not a separate window and not a floating modal. It is visually attached to the main app shell, opens from the right edge under the topbar, and runs from the top of the content area to the bottom of the layout.

The browser companion is intentionally conversation-adjacent, not conversation-replacing. The main chat remains visible behind or beside the panel, the panel can be opened by the user or requested by an agent or tool, and the browser session belongs to the current workspace rather than to the current thread.

## Approved Decisions

### UX and layout

- The browser companion is a **full-height right sheet** attached to the right edge of the main UI.
- It opens as a **slide-over panel**, not a pushed permanent split layout and not a detached popup.
- It appears **below the topbar** and extends to the **bottom of the layout**, covering the right side of both thread content and composer area.
- The preferred visual feel is **balanced**, meaning the browser is large enough for real reading and login work while preserving clear visibility of the chat surface.
- The initial panel width target is **480px**, clamped to a practical range of **420px to 520px** based on available window width. User-resizable panel width is out of scope for the first implementation.

### Browser capability

- The browser companion is a **mini-browser** rather than a read-only preview.
- It includes normal browser controls: address bar, back, forward, reload, loading state, and page title.
- The user can paste arbitrary URLs, including login URLs used to establish authenticated web sessions.

### Ownership and persistence

- The browser panel UI may be opened and closed freely, but the **browser profile is persistent**.
- Browser state is scoped **per workspace**, not globally for the whole app and not per thread.
- Browser cookies, storage, and authenticated sessions must persist **across app restarts**.

### Agent interaction target

- The long-term product target is **full agent interaction** on the same browser the user is looking at.
- Agent automation must operate on the exact same browser session and authenticated state that the user created.
- The app must not silently use a hidden secondary browser profile for web automation when the visible companion panel exists.

### Safety and settings

- Browser automation permissions are configured in the app **Settings**.
- Default behavior is **safe by default**.
- The default policy is: **ask for confirmation for every agent browser action**.

## Non-Goals

The following are explicitly out of scope for the first implementation milestone:

- A detached browser window or child window product direction
- A generic `<webview>` implementation in the renderer
- A deprecated `BrowserView`-based architecture
- User-resizable panel width
- Multi-tab browsing
- Per-thread browser profiles
- Full agent automation in the first milestone

These can be revisited later, but they are not part of the initial delivery target.

## Technical Direction

### Chosen browser embedding model

Use **`WebContentsView` in the Electron main process** for the browser surface.

This design is preferred because:

- `BrowserView` is deprecated in Electron and should not be used for a new product surface.
- `<webview>` is discouraged by current Electron guidance and is less suitable for a long-lived desktop product surface.
- `WebContentsView` keeps the browser surface native to Electron while allowing the React renderer to remain responsible for shell UI, animation chrome, and conversation layout.

### Renderer responsibility

The renderer owns the browser companion shell and all surrounding UI:

- panel open and close state
- panel animation state
- panel chrome
- address bar and controls
- current title, URL, and loading indicators
- confirmation affordances and browser-related settings UI
- measurement of the panel rectangle used to position the native browser surface

The renderer does **not** directly host the web page content itself.

### Main-process responsibility

The main process owns the browser engine and workspace-scoped persistence:

- creating and destroying `WebContentsView`
- attaching the browser surface to the current `BrowserWindow`
- positioning and resizing the browser surface to match the panel shell rectangle
- mapping workspaces to persistent browser profiles
- wiring browser events back to the renderer
- enforcing browser automation permissions
- providing the automation entrypoint used by future agent-driven browser tasks

## Architecture Overview

### Renderer components

#### `apps/desktop/src/browser-panel.tsx`

Primary React component for the browser companion shell. Responsibilities:

- render the attached right sheet chrome
- render address bar and browser controls
- render loading/title/error state
- expose close action
- expose any future browser action prompts in a conversation-consistent UI style

#### `apps/desktop/src/browser-panel-state.ts`

Shared renderer-side types and helpers for browser panel state. This keeps browser-panel concerns from expanding `desktop-state.ts` too quickly.

#### `apps/desktop/src/App.tsx`

App-level orchestration point. Responsibilities:

- hold browser panel open and transition state
- coordinate browser panel shell with existing thread and composer surfaces
- measure the live panel rectangle and publish it to the main process
- preserve timeline and composer stability while the panel opens and closes
- mount the browser panel only on the thread surface

#### `apps/desktop/src/topbar.tsx`

Add a browser companion control next to the existing topbar actions so the user can open or close the browser manually.

### Main-process components

#### `apps/desktop/electron/browser-panel-manager.ts`

Owns the lifecycle of the visible browser companion `WebContentsView`.

Responsibilities:

- create the browser surface on demand
- hide or reveal the surface with the panel lifecycle
- set bounds whenever the renderer reports a new rectangle
- navigate, reload, go back, and go forward
- track page metadata such as title and loading state
- keep one active browser surface per workspace when needed

#### `apps/desktop/electron/browser-profile-registry.ts`

Maps each workspace to a persistent Electron session or partition and ensures storage survives app restarts.

Responsibilities:

- derive a stable storage location from workspace identity
- create or reuse the matching browser session
- guarantee isolation between workspaces
- expose the correct session to the browser panel manager

#### `apps/desktop/electron/browser-automation-bridge.ts`

Future-facing automation boundary for agent use.

Responsibilities:

- accept browser automation requests from the app runtime
- verify that the browser panel and workspace session exist
- enforce the configured permission policy
- execute browser reads, navigation, and later click/type/submit actions
- report actions and pending confirmations back to the renderer

#### `apps/desktop/electron/main.ts`

Wires the new browser panel manager, profile registry, and automation bridge into app startup and IPC handler registration.

#### `apps/desktop/electron/preload.ts`

Exposes a narrow browser companion API to the renderer without weakening existing isolation rules.

### Shared IPC contract

#### `apps/desktop/src/ipc.ts`

Defines browser companion IPC channels and TypeScript contracts for:

- opening and closing the browser panel
- navigating to a URL
- requesting back, forward, and reload
- updating the panel bounds
- publishing browser state updates
- publishing confirmation requests and results

## Browser Panel State Model

The renderer-visible browser panel state must be small and UI-oriented.

Recommended structure:

```ts
type BrowserPanelMode = "hidden" | "opening" | "open" | "closing";

interface BrowserPanelState {
  readonly mode: BrowserPanelMode;
  readonly workspaceId?: string;
  readonly url: string;
  readonly title: string;
  readonly loading: boolean;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly lastError?: string;
}
```

This state is UI-facing only. The following must remain main-process only:

- actual `WebContentsView` instances
- actual Electron sessions and partitions
- storage paths and profile internals
- low-level browser event subscriptions
- pending automation internals beyond what the renderer needs to present

## Settings Model

The app must expose a browser automation setting with three modes:

1. **Ask for every browser action**
2. **Allow navigation/read, ask for interactions**
3. **Allow full browser automation**

The first mode is the default for new users.

The settings storage can be app-global in the first milestone, but the browser session itself remains workspace-scoped. This keeps permission defaults simple while still isolating authentication by workspace.

## UI Behavior Requirements

### Opening behavior

- The browser panel may be opened by the user from the topbar.
- The browser panel may also be opened by an agent or tool request.
- When an agent or tool opens the panel, the user still retains control to close it or navigate elsewhere.

### Layout behavior

- The panel is visually attached to the right edge of the thread surface.
- The panel does not cover the topbar.
- The panel does cover the right side of the thread content and the right side of the composer region.
- The panel opens with a smooth slide-over motion rather than a hard cut.
- The chat surface remains visible and recognizable while the panel is open.

### Focus behavior

- When the user clicks the browser surface, focus should move into the browser naturally.
- When the panel closes, focus should return to the composer if the user was previously on the thread surface.
- Typing into the address bar must not interfere with conversation shortcuts.

### Navigation behavior

- The address bar accepts pasted URLs.
- The browser should support normal login and redirect flows.
- Reload, back, and forward reflect actual browser state and availability.

## Data Flow

### Open panel

1. The user clicks a topbar button, or an agent/tool issues an open-browser request.
2. The renderer moves the browser panel shell to `opening` and then `open`.
3. The renderer measures the final live rectangle for the panel shell.
4. The renderer publishes the rectangle to the main process.
5. The main process reveals or repositions the `WebContentsView` to match the shell.

### Navigate and login

1. The user types or pastes a URL into the address bar.
2. The renderer sends a navigate request with the active workspace id.
3. The main process resolves the persistent workspace browser profile.
4. The browser panel manager loads the URL into the visible `WebContentsView`.
5. Cookies, storage, and authenticated state are written into the workspace profile.

### Agent-assisted browser work

1. The agent issues a browser action request.
2. The automation bridge resolves the active workspace and browser surface.
3. The automation bridge checks the configured permission policy.
4. If confirmation is required, the renderer receives a confirmation request and shows it to the user.
5. If approved, the action executes on the same browser session the user sees.

### Renderer updates

The main process publishes only the state needed by the UI:

- current URL
- page title
- loading state
- back and forward availability
- last browser error
- confirmation prompt state when relevant

## Workspace Profile Model

Each workspace gets its own persistent browser profile.

Requirements:

- a login performed in workspace A must not silently authenticate workspace B
- closing the panel must not clear workspace browser storage
- restarting the app must restore the ability to reuse the prior authenticated workspace browser session
- switching threads within the same workspace must keep the same browser profile
- switching workspaces must switch the active browser profile

## Permission and Confirmation Design

The initial product experience must be conservative.

### Default

- new users start with **Ask for every browser action**

### Confirmation content

Each confirmation prompt should show:

- the target site or domain when known
- the type of action being requested
- the origin of the request, such as the active agent run or tool
- clear actions for **Allow once**, **Cancel**, and later an optional **Always allow** path if the product expands that way

### First milestone confirmation scope

The first milestone does not yet need full browser automation, but the settings model and renderer affordance should be designed so later milestones can add confirmation prompts without reworking the architecture.

## Implementation Phasing

### Phase 1: User-usable browser companion

Deliver:

- full-height right sheet
- topbar toggle
- `WebContentsView` browser surface
- address bar, back, forward, reload
- workspace-scoped persistent browser profiles
- login/session persistence across app restart
- renderer and main-process state sync for loading/title/url

Do not deliver yet:

- full agent click/type/submit automation
- confirmation prompts for browser automation actions beyond structural support

### Phase 2: Agent-controlled open, focus, and navigation

Deliver:

- agent/tool requests can open the panel
- agent/tool requests can focus and navigate the visible browser
- the app can read minimal browser state for orchestration

### Phase 3: Full agent interaction on the same authenticated browser

Deliver:

- click
- type
- submit
- confirmation flows based on settings policy
- visible action reporting sufficient for trust and debuggability

## Testing Strategy

Desktop verification must happen on the real Electron surface.

### Core lane coverage

Create a focused `core` Playwright spec for the browser panel shell and basic browser lifecycle. At minimum, verify:

- opening and closing the panel from the topbar
- the panel appears as a full-height right sheet under the topbar
- entering a URL updates the browser and reflected browser state
- title, URL, and loading indicators update in the renderer
- thread timeline and composer do not visibly break when the panel opens and closes
- switching workspaces switches the active browser profile context

Recommended spec location:

- `apps/desktop/tests/core/browser-panel.spec.ts`

### Later lane coverage

- Phase 2 can remain mostly in `core` if automation is stubbed or local.
- Phase 3 likely needs `live` coverage for agent-driven browser orchestration and permission flows.

## Risks and Design Constraints

### Native-surface animation mismatch

The browser panel shell is animated in the renderer, but the actual browser content is a native Electron view. Bounds synchronization must be deliberate so the panel chrome and the browser content move together closely enough to feel like one surface.

### Focus management

The address bar, browser surface, topbar shortcuts, and composer shortcuts all need predictable focus handoff.

### Workspace isolation

Workspace-specific browser sessions must be implemented carefully to avoid accidental sharing of authenticated state.

### Safety defaults

The product target includes powerful automation on authenticated pages. Default settings must remain conservative and visible.

## File Boundaries for Implementation

The implementation should introduce or modify the following key files:

- Create: `apps/desktop/src/browser-panel.tsx`
- Create: `apps/desktop/src/browser-panel-state.ts`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/topbar.tsx`
- Modify: `apps/desktop/src/styles/main.css`
- Create: `apps/desktop/electron/browser-panel-manager.ts`
- Create: `apps/desktop/electron/browser-profile-registry.ts`
- Create later or stub now: `apps/desktop/electron/browser-automation-bridge.ts`
- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/electron/preload.ts`
- Modify: `apps/desktop/src/ipc.ts`
- Modify: `apps/desktop/src/desktop-state.ts`
- Modify: `apps/desktop/src/settings-general-section.tsx` or create a dedicated browser settings section if the settings surface grows beyond a small addition

## Recommended Planning Boundary

The first implementation plan should target **Phase 1** and only the minimal structural hooks needed to support Phase 2 cleanly later.

That means the first plan should not attempt full browser automation. It should instead deliver:

- the visible browser companion surface
- persistent workspace profiles
- clean panel/browser state plumbing
- a settings foundation for future automation permissions

This keeps the first milestone small enough to verify on the real Electron surface without diluting the long-term product target.

