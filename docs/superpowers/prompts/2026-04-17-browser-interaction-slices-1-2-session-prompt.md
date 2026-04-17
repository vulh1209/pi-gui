# Prompt For A New Session: Browser Interaction Layer (Slices 1 + 2)

Use this prompt in a separate chat session.

---

You are continuing work on `pi-gui` browser companion integration.

## Critical execution rules

- **Use this existing worktree exactly:**
  `/Users/vu.le/.config/superpowers/worktrees/pi-gui/feat/browser-view`
- **Do not create a new worktree.**
- **Current branch:** `feat/browser-view`
- **Use subagents.** Prefer `subagent-driven-development` for execution.
- **Do not switch branches unless explicitly required by the user.**

## First read these files

1. `AGENTS.md`
2. `apps/desktop/AGENTS.md`
3. `docs/superpowers/specs/2026-04-17-browser-companion-design.md`
4. `docs/superpowers/specs/2026-04-17-browser-interaction-layer-design.md`
5. `docs/superpowers/plans/2026-04-17-browser-interaction-slices-1-2.md`

## Current implementation status already completed in this worktree

Browser companion Phase 1 is already implemented and verified on this branch.

Relevant commits already present:

- `c839bfa` — browser companion shell + policy setting
- `3a35439` — live browser companion navigation
- `9d7245d` — per-workspace browser profile persistence
- `26dcb30` — focus and pinning stability
- `8099a8f` — browser interaction layer design doc

## Your job

Execute the plan in:

- `docs/superpowers/plans/2026-04-17-browser-interaction-slices-1-2.md`

using **subagent-driven-development**.

Target scope for this session:

- Slice 1: host browser bridge primitives + slash/browser command surface
- Slice 2: natural-language routing for common open/focus/navigate intents

## Expected behavior after completion

- `/browser open https://www.google.com` opens the visible browser companion and logs verbose browser actions in the timeline
- `/browser back`, `/browser forward`, `/browser reload`, `/browser focus` work on the same browser session
- natural language such as `mở google bằng browser companion` routes into the same browser action pipeline
- browser interaction timeline rows appear in the normal thread timeline
- `apps/desktop/tests/core/browser-commands.spec.ts` exists and passes
- `apps/desktop/tests/core/browser-panel.spec.ts` still passes
- `pnpm --filter @pi-gui/desktop run test:e2e` passes before finishing

## Execution style

- Read the plan critically first.
- If the plan and current code differ, prefer the existing codebase patterns and keep the design intent intact.
- Use fresh subagents per task.
- After each task: do spec-compliance review first, then code-quality review.
- If subagent harness fails, stop and report that explicitly instead of silently switching workflows.

## Final deliverables

When you finish, report:

1. completed commits
2. tests run and results
3. any deviations from the written plan
4. whether the branch is ready for manual testing / PR

