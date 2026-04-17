# Extensions compact density pass design

- Date: 2026-04-17
- Surface: `apps/desktop` Extensions page
- Visual reference: screenshot at `/var/folders/85/m9d3xqn956sdflsfqwg1r4l00000gn/T/pi-clipboard-1beff341-43b5-413d-bcc1-5df56fc6d97b.png`
- Goal: make the expanded Extensions accordion read as a compact, scan-first tool panel instead of a stack of padded cards

## Problem statement

The current Extensions accordion is functionally correct but visually bulky. In the expanded state:

- package headers are taller than needed
- extension rows feel too card-like
- pills and badges compete with the row title for attention
- the inline detail body has too much padding and chrome
- the local tabs are visually louder than their supporting role

The result is a hierarchy that feels inflated instead of compact.

## Approved direction

Use a compact, scan-first density pass with light hierarchy adjustments.

This means:

1. keep the current interaction model intact
   - package expand/collapse stays the same
   - extension row expand/collapse stays the same
   - inline tabs stay the same
   - actions and controls keep current behavior
2. prefer CSS-only changes where possible
3. reduce density consistently across the whole cluster instead of fixing one padding value in isolation
4. make hierarchy read in this order:
   - package group
   - extension row
   - inline detail
   - tabs / pills / badges as secondary metadata

## In scope

Primary target files:

- `apps/desktop/src/styles/main.css`
- `apps/desktop/src/extensions-view.tsx` only if a small class or hook is needed
- `apps/desktop/src/extensions-surface.tsx` only if a small class or hook is needed

UI areas in scope:

- package group header
- package group body spacing
- extension row spacing and visual weight
- status/meta pills and badges
- expanded detail container spacing
- inline tabs styling and spacing
- supporting spacing inside the detail body where needed for consistency

## Out of scope

- changing runtime behavior
- changing extension data or grouping logic
- changing information architecture of the page
- moving detail into another panel
- adding new controls or features
- broad refactors unrelated to visual density

## Proposed approach

### Approach A: minimal padding-only fix

Reduce the detail panel padding and a few margins.

Pros:
- lowest risk
- fastest change

Cons:
- does not solve the overall bulky feel
- leaves header, row, pills, and tabs visually overweight

### Approach B: compact density pass across the cluster

Adjust spacing and emphasis together across the package header, row, pills, tabs, and detail body.

Pros:
- addresses the actual visual problem shown in the screenshot
- preserves current interactions
- improves scanability without layout refactor

Cons:
- broader visual change than a one-line padding fix

### Approach C: stronger layout refactor

Restructure the expanded detail layout and possibly change DOM hierarchy.

Pros:
- most freedom to redesign

Cons:
- unnecessary for the current issue
- higher test and regression risk

## Recommendation

Choose **Approach B**.

The screenshot shows a system-level density problem, not a single spacing bug. A coordinated compact pass is the smallest change that is likely to produce a clearly better Electron surface.

## Visual design rules for implementation

### Package group header

- reduce vertical padding
- keep title readable but less tall overall
- keep count visible but secondary
- keep source and scope pills smaller and quieter
- reduce open-state chrome so the header signals state without dominating the page

### Extension row

- reduce row padding
- keep title as the primary anchor
- reduce the visual weight of the enabled badge and meta pills
- reduce hover/open shadow slightly so the row feels like a dense list row, not a separate card

### Expanded detail

- reduce left/right/top padding
- tighten the gap between row and detail body
- soften the left border and surrounding chrome
- keep the detail visually attached to the active row

### Local tabs

- keep tabs compact and clearly secondary
- reduce tab padding and prominence
- ensure tabs do not visually overpower the row title or content below

### Overall hierarchy

The package group should remain the top-level bucket, the extension row should remain the main focus, and the detail body should feel like inline follow-up content rather than a new major panel.

## Success criteria

The change is successful when all of these are true on the real Electron surface:

1. the expanded package and row cluster looks materially more compact
2. the row title and row identity read before pills, badges, and tabs
3. the detail body feels attached to the expanded row rather than detached below it
4. the UI is easier to scan vertically when multiple extensions are shown
5. interaction behavior is unchanged

## Verification plan

1. verify on the real Electron Extensions surface, not only in code review
2. use the smallest relevant Extensions live spec first
3. inspect the surface with browser/CDP tooling after the change
4. if selectors or assertions need minor updates because of improved semantics or hierarchy, update tests to match the shipped UI instead of preserving inferior structure

Likely verification targets:

- `apps/desktop/tests/live/extensions.spec.ts`
- `apps/desktop/tests/live/extensions-native-surfaces.spec.ts`
- the most targeted spec that exercises the refined UI

## Risks and mitigations

### Risk: first pass is still too bulky

Mitigation:
- verify visually on Electron after the first pass
- do one more focused CSS tightening pass if 2 or more hierarchy/density problems remain obvious

### Risk: over-compressing the UI

Mitigation:
- keep titles readable
- keep controls clickable
- compress chrome and spacing before compressing content readability

### Risk: accidental behavior changes

Mitigation:
- keep implementation mostly in CSS
- avoid changing expand/collapse, tabs, or action wiring
