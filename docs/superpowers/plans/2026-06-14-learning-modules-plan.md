# Learning Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat 8,475-card browsing experience with evidence-aligned modules, daily review queues, and explicit progress tracking for the future AI speaking coach.

**Architecture:** Keep the site static and local-first. Add pure scheduling functions in `src/scheduler.js`, then let `src/app.js` render module navigation, daily queues, and progress from `localStorage`. Record the AI speaking coach as a secure next-phase item requiring a backend token broker.

**Tech Stack:** Vanilla HTML/CSS/JS, `node --test`, static GitHub Pages via `gh-pages`.

---

### Task 1: Scheduling Module

**Files:**
- Create: `/Users/chenenjia/Desktop/vocab-review-pages/src/scheduler.js`
- Create: `/Users/chenenjia/Desktop/vocab-review-pages/test/scheduler.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildModules, getDueEntries, nextReviewDate } from "../src/scheduler.js";

test("buildModules groups entries into 100-card modules and 20-card packs", () => {
  const entries = Array.from({ length: 205 }, (_, index) => ({ id: `id-${index}`, theme: "Theme" }));
  const modules = buildModules(entries);
  assert.equal(modules.length, 3);
  assert.equal(modules[0].entries.length, 100);
  assert.equal(modules[0].packs.length, 5);
  assert.equal(modules[2].entries.length, 5);
});

test("getDueEntries returns entries whose due date is today or earlier", () => {
  const entries = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const progress = {
    a: { dueAt: "2026-06-13T00:00:00.000Z" },
    b: { dueAt: "2026-06-15T00:00:00.000Z" },
  };
  assert.deepEqual(getDueEntries(entries, progress, new Date("2026-06-14T00:00:00.000Z")).map((entry) => entry.id), ["a"]);
});

test("nextReviewDate schedules known cards farther out than again cards", () => {
  const now = new Date("2026-06-14T00:00:00.000Z");
  assert.equal(nextReviewDate("again", 0, now).toISOString(), "2026-06-15T00:00:00.000Z");
  assert.equal(nextReviewDate("known", 2, now).toISOString(), "2026-06-21T00:00:00.000Z");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/scheduler.test.mjs`
Expected: fails because `src/scheduler.js` does not exist.

- [ ] **Step 3: Implement scheduler**

Create pure helpers:
- `buildModules(entries, moduleSize = 100, packSize = 20)`
- `getDueEntries(entries, progress, now)`
- `getNewEntries(entries, progress, limit)`
- `nextReviewDate(status, reviewCount, now)`

- [ ] **Step 4: Verify**

Run: `npm test -- test/scheduler.test.mjs`
Expected: all scheduler tests pass.

### Task 2: UI Integration

**Files:**
- Modify: `/Users/chenenjia/Desktop/vocab-review-pages/index.html`
- Modify: `/Users/chenenjia/Desktop/vocab-review-pages/src/app.js`
- Modify: `/Users/chenenjia/Desktop/vocab-review-pages/styles.css`

- [ ] Add dashboard elements for daily queue, module selector, pack selector, and project progress.
- [ ] Update `markCurrent()` so Known/Again sets `reviewCount`, `status`, and `dueAt`.
- [ ] Render `Due`, `New`, `Weak`, and selected module list instead of a raw global list.
- [ ] Keep search and filters working across all entries.

### Task 3: AI Speaking Coach Progress

**Files:**
- Create: `/Users/chenenjia/Desktop/vocab-review-pages/docs/progress.md`

- [ ] Document safe architecture: GitHub Pages frontend, separate backend/serverless token broker, no OpenAI API key in browser.
- [ ] Track status as `planned`, with next implementation steps.

### Task 4: Verification and Deploy

**Files:**
- Existing static site files.

- [ ] Run `npm test`.
- [ ] Run `npm run build:data`.
- [ ] Preview at `http://127.0.0.1:4173/`.
- [ ] Verify desktop and mobile layout.
- [ ] Commit, push `main`, and push `main:gh-pages`.
