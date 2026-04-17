---
name: electron-ui-refinement
description: Use when refining `pi-gui` Electron renderer UI against HTML refs, screenshots, or approved visual mockups.
---

# Electron UI Refinement

Apply this skill when changing the UI in `apps/desktop/` and the goal is visual parity, denser hierarchy, or better interaction design rather than just functional correctness.

## Goal

Keep `pi-gui` UI work anchored to a visual source of truth:
- approved HTML mockup
- screenshot ref
- browser mockup from brainstorming
- existing Electron surface after a successful polish pass

## Core Rule

**Do not stop at “functionally correct”.**
The change is only done when the Electron UI hierarchy, density, and interaction behavior are close to the approved reference.

## Workflow

1. Identify the target surface.
   - Example: Extensions page, composer, timeline row, accordion detail, settings tab.
2. Identify the visual source of truth.
   - HTML mockup, screenshot, or approved design spec.
3. Compare the current implementation against the reference before editing.
4. Implement the smallest UI change that moves the live Electron surface closer to the reference.
5. Verify on the real Electron surface.
6. If the DOM/test selectors changed, update tests to match the new semantics instead of forcing the UI back to the old structure.

## Electron-Specific UI Rules

### Hierarchy first
For `pi-gui`, hierarchy beats ornament.

Preferred order:
- package group
- extension row
- inline detail

Do not let badges, tabs, or card chrome overpower the hierarchy.

### Density over bulk
When the goal is scanability:
- prefer rows over oversized cards
- prefer inline detail over detached side panels
- keep metadata secondary
- keep actions close to the content they act on

### Interaction in place
If the user is already focused on a row or section:
- prefer inline expansion/collapse
- avoid teleporting detail to a distant panel unless the task truly needs a dedicated workspace

### Tabs are local, not dominant
Local tabs inside expanded detail should:
- stay compact
- act as mode switches
- not become visually louder than the row content itself

### State clarity
Expanded/collapsed state must be obvious at a glance.
Use:
- one strong active row/group highlight
- clear affordance for collapsed vs expanded state
- minimal but visible state cues

## Visual Parity Checklist

Before claiming completion, compare against the reference for:
- hierarchy
- spacing
- density
- row/card weight
- badge prominence
- tab prominence
- expand/collapse affordance
- where detail is rendered

If 2+ of these still differ materially from the ref, keep iterating.

## Test + Verification Rules

For `apps/desktop` UI work:
- verify on the real Electron surface
- prefer the smallest relevant Playwright spec first
- then rerun the owning lane if the surface is lane-sensitive

Typical proof surfaces:
- `apps/desktop/tests/live/extensions-native-surfaces.spec.ts`
- `apps/desktop/tests/live/extensions.spec.ts`
- whichever focused spec actually exercises the changed UI

If screenshots or selectors break after a layout refactor:
- update them to the new semantics
- do not preserve an inferior DOM shape just to keep old tests green

## Good outcomes

- The shipped UI looks recognizably closer to the approved HTML/mockup
- The page is easier to scan
- Interaction stays local and understandable
- Tests verify the new behavior semantically

## Bad outcomes

- Functionally correct but visually still far from the ref
- Added more card chrome instead of reducing clutter
- Moved detail farther away from the user’s current focus
- Preserved brittle old selectors by compromising the UI

## References

- `./references/checklist.md`
