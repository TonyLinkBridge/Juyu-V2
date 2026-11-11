# Visible review return reasons implementation plan

> Execute inline using superpowers:executing-plans, with test-driven-development and verification-before-completion.

**Goal:** Authors of knowledge articles, OPS, Reference and Q&A can see saved return feedback directly without changing content, publication, history, authorization or URLs.
**Architecture:** Add optional read-only feedback to the existing protected editor snapshot from the latest review receipt. Render it above the editor, retain it while revising a rejected draft, and stop presenting it as current after resubmission. Add detail links in both workspace views and point return notifications to the protected review page without posting private reasons to Slack.
**Spec:** User-approved four-part fix in the current chat, 2026-11-11.
**Constraints:** No production writes or draft edits. Preserve existing RLS and server authorization. No schema migration, dependencies, new public endpoint or changes to unrelated local edits.

- [x] Add regression tests for all four kinds, author access, revoked/support denial, multiround feedback and publication/history preservation; run and observe failure.
- [x] Add feedback metadata to the authorized editor read and render its plain text, reviewer, time and version. Keep previous-round labeling after save and hide it on resubmission.
- [x] Add review-reason links to list and board. Route only return Slack buttons to review details; keep reason text private.
- [x] Browser-test the actual components with isolated fixtures on desktop/mobile, including multiline/HTML-like text, save/reload, resubmission and preserved formal content.
- [x] Run verify:build, critical browser tests, reader navigation and all database contracts. Review diff and commit only this fix.
Release gate after push: confirm the exact GitHub Verify run for the tested commit on main. Do not report a pending check as passed.
