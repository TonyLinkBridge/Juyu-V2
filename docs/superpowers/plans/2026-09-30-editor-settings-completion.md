# Editor Settings Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the compact editor workspace and replace the unfinished six-card settings flow with three complete, state-aware groups.

**Architecture:** Keep the existing BlockNote editor and draft contract. Reorganize only the editor presentation and visibility rules; use existing save, history, lifecycle, upload, category, and custom-field functions without inventing parallel behavior.

**Tech Stack:** Next.js 16, React 19, TypeScript, BlockNote, Playwright.

**Spec:** User-approved combination of concept 3 editor workspace and structured settings drawer from the 2026-09-30 browser audit.

## Global Constraints

- Keep all current draft, review, publication, upload, history, recovery, category, and custom-field data paths.
- Do not add replacement workflows or duplicate controls.
- New articles do not show update notes; custom fields render only when configured or retained.
- Unselected inactive categories stay out of the picker; an already assigned inactive category remains removable.
- Settings must expose real save state and only promise actions currently available.

## Review Focus

- Existing unpublished drafts still hide update notes.
- Published articles still edit and save release notes.
- Disabled selected categories remain removable.
- Frozen review drafts remain readable and non-editable.
- Mobile drawer and bottom tool rail do not overflow.

---

### Task 1: Grouped settings behavior

**Files:**
- Modify: `tests/e2e/editor.spec.ts`
- Modify: `src/components/editor/ArticleEditor.tsx`
- Modify: `src/app/feedback.css`
- Modify: `src/app/globals.css`

- [x] Write failing browser tests for three grouped settings, conditional update notes/custom fields, truthful management links, and one preview action.
- [x] Run the focused test and confirm the old six-card menu fails it.
- [x] Replace the old two-level menu with Content & access, Cover & attachments, and Publish & manage groups.
- [x] Run the focused test and existing editor tests.

### Task 2: Category picker cleanup

**Files:**
- Modify: `tests/e2e/categories-editor.spec.ts`
- Modify: `src/components/categories/ArticleCategories.tsx`

- [x] Write a failing assertion that inactive unselected categories are hidden while inactive assigned categories remain visible.
- [x] Run the focused test and confirm the stale entry appears.
- [x] Filter the picker by effective enabled state or current assignment.
- [x] Run category editor tests.

### Task 3: Compact editor workspace and recovery placement

**Files:**
- Modify: `tests/e2e/editor.spec.ts`
- Modify: `src/components/editor/ArticleEditor.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/feedback.css`

- [x] Write failing assertions for no rail preview duplicate, no outline lesson before the canvas, and compact recovery access beside save state.
- [x] Run the focused test and confirm the current layout fails.
- [x] Move recovery into the save-status area, move outline help into settings, and tighten first-viewport spacing.
- [x] Run editor, category, fields, accessibility, typecheck, lint, unit tests, and production build.
