# Storybook, UI polish, and devtools design

## Problem

The current Extensions accordion UI is functionally correct and verified on the Electron surface, but it still drifts from the approved HTML reference in visual density, hierarchy, and inline detail feel. The team now wants a more repeatable frontend workflow for refining Electron UI and preventing future drift.

At the same time, the repo lacks a lightweight component-isolation environment for UI iteration, and the desktop dev experience would benefit from automatic React DevTools availability during local development.

## Goal

Implement the next frontend iteration in three steps:

1. Add a minimal Storybook setup for `apps/desktop` focused on the Extensions accordion surface.
2. Use that setup to refine the accordion UI and related inline UI primitives so the shipped UI aligns better with the approved HTML reference.
3. Wire `electron-devtools-installer` into desktop dev mode so React DevTools auto-installs when possible and only warns on failure.

## Decisions already made

- Storybook scope should be limited but useful:
  - one main Extensions accordion story
  - a few support stories for key subparts
- UI polish should cover:
  - Extensions accordion page
  - directly related primitives such as badges, tabs, and inline detail blocks
- `electron-devtools-installer` should auto-run in dev mode and only warn on failure.

## Non-goals

- Do not convert the whole app into a Storybook-first architecture.
- Do not Storybook every renderer component in the repo.
- Do not change production behavior with devtools-specific logic.
- Do not use Storybook as a substitute for verifying the real Electron surface.

## Proposed architecture

## 1. Minimal Storybook setup in `apps/desktop`

Add a Storybook configuration under `apps/desktop/.storybook/` and keep it scoped to UI iteration for the desktop renderer.

### Storybook purpose

Storybook is not being added to document the entire app. It is being added as a fast, isolated UI workshop for:
- package group hierarchy
- extension rows
- inline detail rendering
- badge/tab density and visual weight
- state combinations that are cumbersome to reach repeatedly inside the full Electron shell

### Story set

#### Primary story

- **ExtensionsAccordionPage**
  - package groups rendered
  - one package open by default
  - one row expanded inline
  - representative Tungdev-like detail content

#### Supporting stories

- **PackageGroup**
- **ExtensionRow**
- **ExtensionInlineSurface**
- optionally **VisibilityControls** if it improves iteration clarity

This is enough to iterate on the layout without over-scoping Storybook.

## 2. Fixture-driven story data

Storybook stories should use local fixture data instead of real app state.

Add a fixture module that provides:
- grouped package examples
- Tungdev-style row examples
- visible vs hidden commands
- inline settings-form surfaces with enum and boolean fields

This keeps Storybook fast, deterministic, and focused on visual behavior.

## 3. UI polish target areas

The accordion architecture should stay intact. This phase is about visual refinement and density control.

### Package group header

Refine:
- weight and spacing of the package title
- how extension count is shown
- source/scope badge prominence
- expand/collapse affordance clarity

### Extension row

Refine:
- row density
- title/summary/status alignment
- reduction of excessive card feel
- one-line summary quality
- consistent placement of state indicators

### Inline detail block

Refine:
- stronger local grouping without looking like a detached full panel
- better vertical rhythm
- more compact, contextual tab presentation
- inline-surface readability

### Configure tab

Refine:
- label/description/control balance
- compact field rows
- control sizing and grouping

### Commands tab

Refine:
- visibility badges and override controls
- reduce repetitive labeling
- keep the effective state clear but not noisy

### Diagnostics tab

Refine:
- keep diagnostics legible
- make them visually secondary to Configure/Commands unless there are actual issues

## 4. Source of truth and verification

The approved HTML mockup remains the visual reference.

Verification loop should be:
1. Storybook refinement for fast iteration
2. comparison against the HTML reference for hierarchy/density
3. replay on the real Electron surface
4. rerun the relevant Playwright coverage

This avoids two common failures:
- polishing only in code without seeing the real result
- polishing only in Storybook and letting Electron drift

## 5. Devtools integration in desktop dev mode

Add a small dev-only helper in the Electron main process to install React DevTools automatically.

### Behavior

- only in dev mode
- runs after app startup is stable enough for local development
- attempts React DevTools install automatically
- if install fails, logs a warning and continues without crashing the app

### Constraints

- no effect in production/package builds
- no renderer coupling
- no hard failure on missing extension support or network/cache issues

## 6. Why this sequence works

### Storybook first

Gives a fast, isolated loop for tuning the accordion layout without repeatedly driving the entire Electron shell.

### UI polish second

Uses Storybook as a workshop, but lands changes in the real app components and verifies them in Electron.

### Devtools third

Improves ongoing local debugging after the renderer surface is in better shape, without blocking the design work.

## 7. Testing strategy

### Storybook smoke

At minimum, Storybook should start and render the primary accordion story.

### Desktop typecheck

Keep `apps/desktop` typecheck green.

### Focused UI proof

Rerun the most relevant extensions accordion spec(s), especially:
- `apps/desktop/tests/live/extensions-native-surfaces.spec.ts`

### Practical lane proof

Rerun:
- `pnpm --filter @pi-gui/desktop run test:e2e:live`

accepting the current practical expectation of green-with-intentional-real-auth-skips.

## 8. Risks

### Risk: Storybook becomes maintenance overhead

Mitigation:
- keep story scope intentionally small
- only create stories for surfaces actively used in UI refinement

### Risk: Storybook diverges from Electron reality

Mitigation:
- use the same renderer components
- require Electron-surface verification before claiming completion

### Risk: visual polish adds too much new chrome

Mitigation:
- keep the accordion hierarchy as the primary structure
- favor compaction and hierarchy over decoration
- use the HTML reference and the local `electron-ui-refinement` skill checklist during review

### Risk: devtools install is flaky

Mitigation:
- dev-only
- warning-only failure path
- no production effect

## Success criteria

1. Storybook is available for `apps/desktop` with one main Extensions accordion story and a few supporting stories.
2. The shipped Extensions accordion UI is visibly closer to the approved HTML reference.
3. Package headers, extension rows, inline detail blocks, tabs, and badges feel denser and clearer.
4. Relevant desktop tests still pass.
5. React DevTools auto-installs in dev mode when possible and only warns on failure.
