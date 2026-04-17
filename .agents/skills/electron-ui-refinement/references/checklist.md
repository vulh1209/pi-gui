# Electron UI Refinement Checklist

## Hierarchy
- Is the main information hierarchy obvious within one second?
- Does the layout reflect the approved structure (for example package → row → inline detail)?
- Are secondary labels visually quieter than primary content?

## Density
- Are rows/cards denser when scanability is the goal?
- Is any block larger than it needs to be?
- Could metadata be compressed into badges, chips, or one-line summaries without losing meaning?

## Interaction
- Is detail shown in place when the user expects to stay in context?
- Is expanded/collapsed state immediately obvious?
- Is there a single dominant active item rather than many competing highlights?

## Parity with Ref
- Does spacing roughly match the ref?
- Does the layout mode match the ref (row vs card, inline vs panel, grouped vs flat)?
- Are tabs and badges visually subordinate to the main structure?

## Verification
- Did you inspect the actual Electron UI after the change?
- Did you run the smallest relevant Playwright spec?
- If the UI structure changed, did you update selectors/assertions to match the new semantics?
