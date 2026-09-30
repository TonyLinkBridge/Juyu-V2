# Root Directory Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce root-directory clutter by moving project documentation into their existing documentation areas while preserving every runtime, build, test, and deployment path.

**Architecture:** Keep Next.js/Vercel conventions and runtime assets at the repository root. Move only human-maintained project documents, then update all references and verify that no source, script, test, or deployment configuration still depends on their old paths. Generated caches and test output remain outside the documentation tree.

**Tech Stack:** Git, Markdown, Next.js, npm scripts, TypeScript, existing repository checks.

**Spec:** The approved root-directory audit from the 2026-09-30 conversation.

## Global Constraints

- The actual source checkout is `/Users/tony/Documents/ChatGPT/Juyu V2`.
- Do not move or rename `src`, `public`, `tests`, `scripts`, `fonts`, Next.js/Vercel configuration, `.github`, `output`, `.next`, `node_modules`, or `.env.local`.
- Preserve all document content; only paths and links may change.
- Do not push or publish as part of this organization pass.

## Review Focus

- Old Markdown links must not remain after the moves; repository-wide reference search verifies this.
- Runtime and test code must continue resolving font and verification-output paths; the path-preservation check verifies this.
- README entry points must point to the new document locations.
- Git must recognize the changes as documentation moves rather than deleted content.

### Task 1: Move project documentation out of the root

**Files:**
- Move: root task list → `docs/project/TASKS.md`
- Move: root design QA report → `docs/design/design-qa.md`
- Modify: `README.md`, `docs/**/*.md` references to the old paths

- [x] Create `docs/project/` and move the root task list into it.
- [x] Move the root design QA report into `docs/design/`.
- [x] Replace every operational reference to the old root paths with the correct relative path.
- [x] Search the repository for the old paths and confirm all remaining mentions are historical plan text or the new paths.
- [x] Confirm Git recognizes the original document contents as renames with only link edits.

### Task 2: Verify build and documentation integrity

**Files:**
- Modify: none unless Task 1 reveals a stale reference

- [x] Run `npm run lint` (0 errors, 1 existing warning).
- [x] Run `npm run typecheck` (passed).
- [x] Run `npm run build` (passed; postbuild checks passed).
- [x] Run `npm test` (558/558 passed).
- [x] `npm run validate:links` was not run because `JUYU_VALIDATE_LINKS_ACTOR_ID` is not configured in this environment.
- [x] Check `git status --short` and inspect the final diff for unintended runtime changes.
