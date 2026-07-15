# Guided Voice Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Night Practice into a 15-minute ChatGPT Voice routine with private self-assessment, targeted retry scheduling, and vocabulary suitability labels.

**Architecture:** Keep the application static and local-first. `src/night-practice.js` owns pure prompt, practice-state, and follow-up selection logic; `src/app.js` renders and persists that state in browser storage. A new suitability module assigns every generated vocabulary entry `active`, `recognition`, or `caution` from documented, conservative rules and explicit overrides.

**Tech Stack:** Vanilla ES modules, Node built-in test runner, static JSON, localStorage.

---

### Task 1: Guided-practice domain logic

**Files:**
- Modify: `src/night-practice.js`
- Modify: `test/night-practice.test.mjs`

- [x] **Step 1: Write failing tests for prompt structure, result normalization, and retry selection**

```js
assert.match(buildNightPracticePrompt(pack), /Do not correct every turn/);
assert.deepEqual(normalizePracticeResults({ a: "used", b: "bad" }), { a: "used" });
assert.deepEqual(getRetryWordIds(progress, pack, 3), ["a", "b"]);
```

- [x] **Step 2: Run `npm test -- test/night-practice.test.mjs` and verify the new tests fail because the functions or prompt clauses do not exist.**

- [x] **Step 3: Add minimal pure helpers and update the copied ChatGPT prompt**

```js
export const PRACTICE_RESULT_OPTIONS = ["used", "prompted", "retry", "skipped"];
export function normalizePracticeResults(results) { /* retain recognised result values */ }
export function getRetryWordIds(progress, pack, limit = 3) { /* prioritise retry then skipped */ }
```

The prompt must: expose a 2/8/3/2 minute routine; make 3-4 active words production targets; ask the tutor to wait through normal thinking pauses; prioritise learner self-repair; cap feedback at three points; and finish with a retry.

- [x] **Step 4: Run `npm test -- test/night-practice.test.mjs` and verify it passes.**

### Task 2: Night Practice interface and persistence

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.js`
- Modify: `test/frontend-copy.test.mjs`

- [x] **Step 1: Write failing DOM-source tests for `Scene`, `Hints`, `Model answers`, the four routine stages, and word-result controls.**

- [x] **Step 2: Run `npm test -- test/frontend-copy.test.mjs` and verify the new assertions fail.**

- [x] **Step 3: Render a segmented disclosure control and four-stage routine in the Night Practice panel.**

`Scene` hides dialogue; `Hints` shows tutor turns only; `Model answers` shows both roles. Add one compact select per target word with `Used naturally`, `Used with a hint`, `Retry tomorrow`, and `Not used`, and save these results with the existing pack completion record.

- [x] **Step 4: Run `npm test -- test/frontend-copy.test.mjs` and verify it passes.**

### Task 3: Vocabulary speaking-suitability classification

**Files:**
- Create: `scripts/speaking-suitability.mjs`
- Modify: `scripts/build-data.mjs`
- Modify: `test/data-integrity.test.mjs`
- Create: `test/speaking-suitability.test.mjs`

- [x] **Step 1: Write failing classification tests.**

```js
assert.equal(classifySpeakingSuitability({ term: "(get/have sb) over a barrel" }), "recognition");
assert.equal(classifySpeakingSuitability({ term: "a child reared on self-indulgence" }), "recognition");
assert.equal(classifySpeakingSuitability({ term: "a bratty kid" }), "caution");
assert.equal(classifySpeakingSuitability({ term: "make up for" }), "active");
```

- [x] **Step 2: Run `npm test -- test/speaking-suitability.test.mjs` and verify it fails because the module does not exist.**

- [x] **Step 3: Implement conservative rules and attach `speakingSuitability` to every generated entry.**

Use explicit caution overrides for pejorative or context-sensitive terms; classify templates, placeholders, long literary constructions, obscure proper-name terms, and entries without usable examples as recognition; classify all other entries as active. Export a classification summary during `npm run build:data`.

- [x] **Step 4: Rebuild `data/words.json`, then run `npm test` and verify all entries carry one valid suitability value.**

### Task 4: Active-word prompt selection and deployment checks

**Files:**
- Modify: `src/app.js`
- Modify: `src/night-practice.js`
- Modify: `test/night-practice.test.mjs`
- Modify: `docs/progress.md`

- [x] **Step 1: Write a test proving that prompt production targets exclude recognition and caution terms when active alternatives exist.**

- [x] **Step 2: Run the focused Night Practice tests after implementation.**

- [x] **Step 3: Supply pack terms with their generated suitability metadata and select up to four active production targets plus up to three retry words.**

- [ ] **Step 4: Update progress documentation, run `npm test`, inspect a local served page, commit the scoped files, and push `main` and `gh-pages`.**
