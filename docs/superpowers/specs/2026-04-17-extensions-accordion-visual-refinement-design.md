# Extensions accordion visual refinement design

## Problem

The current Extensions accordion layout is structurally correct, but still visually drifts from the approved HTML direction. It remains heavier than desired in three areas:

1. **Package group headers** still carry too much visual weight and do not feel compact enough.
2. **Extension rows** need tighter density and cleaner emphasis between title, status, summary, and metadata.
3. **Inline detail blocks** need to feel more like locally expanded detail and less like a detached panel inserted into the list.

The user wants the page to look more polished while preserving the current interaction model:
- group by package
- one package open at a time
- one extension row open at a time
- detail rendered inline under the row

## Goal

Refine the Extensions accordion UI so it feels cleaner, more compact, and closer to the approved HTML direction, with priority order:

1. Package group header
2. Extension row density / spacing
3. Inline detail block and tab balance

## Decisions already made

- Package group header should stay **minimal**.
- Header should show only:
  - package name
  - extension count
  - compact source/scope metadata
- If users need richer information, they should get it only after expanding the package.
- Visual emphasis rule:
  - package open state = moderate emphasis
  - expanded extension row = stronger emphasis
- Overall aesthetic should be **balanced**: compact and professional, but still clearly layered.

## Non-goals

- Do not change the accordion interaction model itself.
- Do not reintroduce the right-side detail panel.
- Do not add extra package-header metadata just because space exists.
- Do not expand scope into unrelated surfaces outside the Extensions flow.

## Proposed refinement

## 1. Package group header

The package group header should behave more like a compact section header than a content card.

### Collapsed header

Show only:
- package name as the dominant label
- extension count as a small secondary counter
- one compact source/scope line or pills
- a clear expand/collapse affordance

### Expanded header

Do not turn the header into a summary card.

Only increase emphasis slightly via:
- clearer border
- slightly stronger background
- more obvious open/closed affordance

The detailed information should stay in the expanded body, not in the header itself.

### Visual target

The user should scan the page as a set of package sections, not a set of large cards.

## 2. Extension row density

Extension rows should feel compact, confident, and readable.

### Row content hierarchy

Primary:
- extension name

Secondary:
- one-line summary

Tertiary:
- enabled/disabled state
- compact metadata such as surface count, command count, tool count, issue count

### Density changes

Refine by:
- reducing vertical padding
- tightening internal gap between title and summary
- shrinking metadata text slightly
- shrinking badges/status pills so they support rather than dominate the row

### Active row emphasis

Expanded row should be visually stronger than the expanded package header.

Use stronger emphasis through:
- clearer border
- more distinct background change
- more obvious attachment to the inline detail block below

This should create a clean hierarchy:
- package group open = context
- extension row open = focus

## 3. Inline detail block

The inline detail block should clearly belong to the extension row above it and should not feel like a separate full-size panel.

### Desired feel

- local
- attached
- compact
- high information density without visual clutter

### Structure

Keep the current tabs and content model:
- Overview
- Configure
- Commands
- Diagnostics

But refine their presentation so they feel like inline expansion content rather than a nested page.

### Detail styling

Use:
- slightly distinct background from the row
- clear but light separation from surrounding list content
- compact internal spacing
- no oversized top chrome

## 4. Tab treatment

Tabs should be local controls, not the dominant visual element.

### Refinement goals

- smaller than current treatment
- less button-heavy
- still clearly interactive
- active tab readable, but not louder than the content itself

Tabs should visually support the idea that the row is expanded in place, rather than launching a different workspace.

## 5. Commands and diagnostics presentation

### Commands tab

This tab should become easier to scan by:
- shortening status labels where possible
- reducing badge noise
- keeping visibility override controls obvious but compact

Key information should still remain visible:
- author default
- effective visibility
- user override when present

### Diagnostics tab

Diagnostics should remain readable but visually softer unless an actual warning/error exists.

Compatibility and diagnostics are supporting information, not the primary reason the row is open.

## 6. Expanded-information rule

Because the package header remains intentionally minimal, richer context appears only after expansion.

### Package body reveals more

When a package is expanded, the user sees:
- extension rows
- extension states
- inline detail for the selected row

### Row detail reveals the most

When an extension row is expanded, the user sees:
- detailed configuration
- command visibility settings
- diagnostics and compatibility

This preserves the compact top-level view while still allowing deep interaction.

## 7. Verification strategy

### Storybook

Use Storybook to refine:
- package header compactness
- row density
- open-state emphasis
- inline detail feel

### Electron surface

Verify on the real desktop surface by rerunning:
- `apps/desktop/tests/live/extensions-native-surfaces.spec.ts`
- practical desktop live lane if needed

The final UI should be judged by the Electron surface, not Storybook alone.

## Success criteria

1. Package headers look compact and scan-friendly.
2. Extension rows feel denser and less card-heavy.
3. Expanded extension rows stand out more strongly than expanded package headers.
4. Inline detail feels attached and contextual rather than panel-like.
5. Tabs, badges, and diagnostics remain functional but visually secondary to the main hierarchy.
6. The result looks noticeably closer to the approved HTML direction without changing the underlying interaction model.
