# Extensions accordion UI design

## Problem

The current Extensions page has improved functionally, but the visual structure is still heavier than necessary. Each extension feels like an oversized card/detail combination, and the right-side detail panel creates too much visual separation between browsing and interacting.

For the new extension-surface direction, especially with packages like `@tungthedev/pi-extensions`, users need a layout that makes it easy to:
- scan extensions at the package level
- understand which extensions belong together
- open a compact detail view in place
- configure an extension without shifting focus to a detached right-side panel

## Goal

Refactor the Extensions page into a grouped accordion layout with these rules:

1. Top-level grouping is by **package/source**.
2. The active package group is expanded by default.
3. Each extension inside a package is rendered as a **single row**, not a large card.
4. Clicking an extension row expands a **small inline detail section directly under that row**.
5. Remove the separate right-side detail panel for normal desktop layouts.

## Decisions already made

- Group extensions by **package/source**.
- The active package group should be expanded.
- Each extension child is a row.
- Each extension row should itself be expandable.
- The expanded detail should render inline beneath the row.
- The right-side detail panel should be removed for this flow.

## Non-goals

- Do not redesign the whole app navigation.
- Do not reintroduce a right-side detail panel in the desktop default layout.
- Do not add a second visual mode for the same page in phase 1.
- Do not change extension-surface semantics or command-visibility semantics in this design; this is a presentation refactor over the current model.

## Proposed layout

## 1. Page structure

The page becomes a nested accordion with three hierarchy levels:

1. **Extensions page shell**
2. **Package groups**
3. **Extension rows with inline expandable detail**

Visually:

- one scrollable content column
- package group headers as the dominant organizational unit
- extension rows nested under the expanded package
- inline detail blocks directly beneath expanded rows

This preserves hierarchy while reducing visual fragmentation.

## 2. Package group level

Each package/source renders as a collapsible group block.

### Package header content

The package header should include:
- package display name
- extension count
- source/scope badges
- short package summary if available
- expand/collapse affordance

Example package groups:
- `@tungthedev/pi-extensions`
- project-local extensions
- legacy/built-in extensions

### Default behavior

- The currently active/selected package group is expanded.
- Other groups are collapsed by default.
- Expanding one group may collapse others if we choose a single-open package rule.

### Recommendation

Use **single-open package behavior** for desktop by default. This keeps the page compact and reduces visual noise.

## 3. Extension row level

Within an expanded package group, each extension is rendered as a compact row.

### Row content

Each row should include:
- extension display name
- one-line purpose/description
- enabled/disabled state
- whether native surfaces exist
- compact metadata such as command count or visibility status
- row expand/collapse affordance

### Row density

Rows should be denser than the previous card layout:
- no large card chrome
- no duplicated metadata blocks unless expanded
- no detached detail surface

The row should communicate enough to decide whether to expand, but not try to show everything at once.

## 4. Inline detail expansion

Clicking a row expands a detail section directly below that row.

This inline detail becomes the new host for:
- Overview
- Configure
- Commands
- Diagnostics

instead of sending the user to a right-side panel.

### Recommended behavior

Within a package group, allow only **one expanded extension row at a time**.

This gives the user:
- compact scanning at rest
- full detail where needed
- lower risk of the page becoming a long stack of open sections

## 5. Detail content structure

The inline detail area should keep the current semantic model, but compress it visually.

### A. Mini tabs inside the expanded row

Each expanded row should have compact tabs:
- Overview
- Configure
- Commands
- Diagnostics

These are not app-level tabs; they are local to the expanded extension row.

### B. Overview tab

Shows lightweight summary information:
- what the extension does
- surfaces available
- tools/shortcuts/flags summary
- path/source summary if relevant

### C. Configure tab

Hosts the current native surface renderer.

For Tungdev `pi-modes`, this is the main value surface:
- Mode
- Inject SYSTEM.md
- Include Pi prompt section

This should render exactly where the user is already looking, with no side jump.

### D. Commands tab

Shows:
- commands contributed by that extension
- author default visibility
- user override
- effective visibility

This is especially important for commands like `/pi-mode`, where the user may choose to expose it to chat.

### E. Diagnostics tab

Shows:
- compatibility information
- terminal-only warnings when applicable
- diagnostics/errors from runtime discovery

## 6. Behavior model

## Package expansion

Preferred desktop rule:
- one package group open at a time

Reason:
- strongest scanability
- less visual clutter
- aligns with the user’s request for something cleaner than the current layout

## Extension expansion

Preferred row rule:
- one extension row expanded inside the open package group at a time

Reason:
- keeps the page stable
- avoids a long wall of open config sections
- supports fast comparison through quick open/close interaction rather than simultaneous expansion

## Tab state

Each expanded row owns its own tab state.

When a row collapses and reopens, we can either:
- reset to Overview, or
- remember the last tab per row

### Recommendation

Reset to **Overview** on reopen in phase 1 unless implementation cost is trivial. Simpler behavior is easier to reason about.

## 7. Tungdev concrete example

For `@tungthedev/pi-extensions`:

### Group header

The package group row shows:
- `@tungthedev/pi-extensions`
- extension count
- package-level badges such as `npm package`, `user scope`, `native surfaces available`

### Child rows

Rows inside that group might include:
- `pi-modes`
- `editor`
- `mermaid`
- `ext-manager`
- `subagents`

### `pi-modes` row when expanded

Inline detail contains:
- compact tabs
- Configure tab active by default or quickly reachable
- native `settings-form` surface rendered inline
- Commands tab showing `/pi-mode` visibility as `Extensions page` by default

This makes `pi-modes` the clearest example of the new interaction model.

## 8. Why this is better than the current UI

### Current pattern

- browse on the left
- inspect/interact on the right
- heavy visual split
- large cards and detail panel compete for attention

### New pattern

- browse and interact in one continuous hierarchy
- package-level grouping makes scanning easier
- extension rows reduce noise
- inline expansion keeps context anchored

This should feel more like a structured inspector and less like two unrelated panes.

## 9. Accessibility and interaction details

- Package headers should be keyboard-focusable and expose expanded state.
- Extension rows should also expose expanded/collapsed state.
- Inline tabs should use existing accessible tab semantics where practical.
- Expanded sections should have clear visual nesting, but not excessive indentation.
- The active expanded row should be visually highlighted enough that users do not lose track of context.

## 10. Responsiveness

Primary target is standard desktop width.

Because the right-side panel is removed, the new layout should naturally behave better on narrower widths.

For narrower windows:
- package header content can wrap
- row metadata can collapse to fewer columns
- inline detail remains directly under the row

This design should be simpler to adapt than the current two-pane layout.

## 11. Implementation direction

Likely renderer changes:
- replace the current left-list + right-detail split in `ExtensionsView`
- introduce package-group derivation from runtime extension metadata
- move `ExtensionsSurface` into an inline expanded-row renderer instead of a detached right-side host
- add package expansion state and row expansion state
- keep the current native surface rendering logic, but place it inline

## 12. Risks

### Risk: page becomes too tall

Mitigation:
- single-open package
- single-open row inside package
- compact row summaries

### Risk: inline detail becomes visually cramped

Mitigation:
- compact but clear local tabs
- slightly elevated inline detail block with stronger background contrast than the row
- avoid overloading the row itself; detail belongs in expansion only

### Risk: package grouping may be ambiguous for some extensions

Mitigation:
- fall back to clear source labels
- allow groups like “Project-local extensions” or “Legacy extensions” when a package name is not meaningful

## Success criteria

1. Extensions are visually grouped by package/source.
2. The active package group expands by default.
3. Each extension appears as a compact row rather than a large card.
4. Clicking a row expands inline detail beneath that row.
5. The right-side detail panel is removed from the default desktop flow.
6. Tungdev `pi-modes` feels natural in this layout, especially for inline Configure and Commands interactions.
