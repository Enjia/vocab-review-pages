import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as nightPractice from "../src/night-practice.js";

const {
  buildNightPracticePrompt,
  getNightPracticePack,
  validateNightPracticePack,
} = nightPractice;

test("night practice packs cover 10-12 existing words with 25-30 turns", async () => {
  const [practiceData, vocabData] = await Promise.all([
    readJson("../data/night-practice.json"),
    readJson("../data/words.json"),
  ]);
  const entryIds = new Set(vocabData.entries.map((entry) => entry.id));

  assert.equal(practiceData.packs.length, 5);

  for (const pack of practiceData.packs) {
    const result = validateNightPracticePack(pack, entryIds);
    assert.equal(result.valid, true, `${pack.id}: ${result.errors.join(", ")}`);
  }
});

test("getNightPracticePack returns the requested pack or first pack", async () => {
  const practiceData = await readJson("../data/night-practice.json");

  assert.equal(getNightPracticePack(practiceData.packs, "module-001-night-003").id, "module-001-night-003");
  assert.equal(getNightPracticePack(practiceData.packs, "missing").id, "module-001-night-001");
});

test("buildNightPracticePrompt gives ChatGPT app a one-question-at-a-time role-play", async () => {
  const practiceData = await readJson("../data/night-practice.json");
  const prompt = buildNightPracticePrompt(practiceData.packs[0]);

  assert.match(prompt, /one question at a time/i);
  assert.match(prompt, /wait for my spoken answer/i);
  assert.match(prompt, /Target words/i);
  assert.match(prompt, /Scene/i);
  assert.doesNotMatch(prompt, /Dialogue scaffold/i);
  assert.doesNotMatch(prompt, /User:/);
  assert.match(prompt, /2 minutes/i);
  assert.match(prompt, /8 minutes/i);
  assert.match(prompt, /Do not correct every turn/i);
  assert.match(prompt, /self-correct/i);
  assert.match(prompt, /at most three/i);
  assert.match(prompt, /Production targets/i);
});

test("night practice retains only recognised word-result values", () => {
  assert.equal(typeof nightPractice.normalizePracticeResults, "function");
  assert.deepEqual(
    nightPractice.normalizePracticeResults({
      active: "used",
      prompted: "prompted",
      retry: "retry",
      skipped: "skipped",
      invalid: "finished",
    }),
    {
      active: "used",
      prompted: "prompted",
      retry: "retry",
      skipped: "skipped",
    },
  );
});

test("night practice prioritises retry and skipped words for the next session", () => {
  assert.equal(typeof nightPractice.getRetryWordIds, "function");
  const pack = {
    targetWords: [
      { entryId: "used" },
      { entryId: "prompted" },
      { entryId: "retry" },
      { entryId: "skipped" },
    ],
  };
  const progress = {
    first: { wordResults: { used: "used", prompted: "prompted", retry: "retry", skipped: "skipped" } },
  };

  assert.deepEqual(nightPractice.getRetryWordIds(progress, pack, 3), ["retry", "skipped", "prompted"]);
});

test("night practice makes active words the only production targets when they are available", () => {
  const prompt = buildNightPracticePrompt({
    scene: "A short planning conversation.",
    targetWords: [
      { entryId: "recognition", term: "a few husks of reason", speakingSuitability: "recognition" },
      { entryId: "caution", term: "a bratty kid", speakingSuitability: "caution" },
      { entryId: "active-one", term: "make up for", speakingSuitability: "active" },
      { entryId: "active-two", term: "keep an eye on", speakingSuitability: "active" },
    ],
    turns: [{ user: "I need a plan.", chatgpt: "What are you trying to improve?" }],
  });
  const productionSection = prompt.slice(
    prompt.indexOf("Production targets"),
    prompt.indexOf("Reference vocabulary"),
  );

  assert.match(productionSection, /make up for/);
  assert.match(productionSection, /keep an eye on/);
  assert.doesNotMatch(productionSection, /husks of reason/);
  assert.doesNotMatch(productionSection, /bratty kid/);
});

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));
}
