import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildNightPracticePrompt,
  getNightPracticePack,
  validateNightPracticePack,
} from "../src/night-practice.js";

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
  assert.match(prompt, /User:/);
  assert.match(prompt, /ChatGPT:/);
});

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));
}
