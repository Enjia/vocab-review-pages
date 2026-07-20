import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as nightPractice from "../src/night-practice.js";

const {
  PRACTICE_STAGES,
  HINT_LADDER,
  advanceNightPracticeSession,
  buildNightPracticePrompt,
  buildNightPracticeSupport,
  buildStuckResponseRescue,
  createNightPracticeSession,
  getNightPracticePack,
  revealNextNightPracticeHint,
  setNightPracticeHintLevel,
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
  assert.match(prompt, /Recognition/i);
  assert.match(prompt, /Supported production/i);
  assert.match(prompt, /Semi-free production/i);
  assert.match(prompt, /Free response/i);
  assert.match(prompt, /Hint 1/i);
  assert.match(prompt, /topic cue/i);
  assert.match(prompt, /keyword cue/i);
  assert.match(prompt, /phrase frame/i);
  assert.match(prompt, /forced choice/i);
  assert.match(prompt, /model answer/i);
  assert.match(prompt, /Production targets/i);
});

test("night practice exposes a fixed four-stage ladder and five-step hint ladder", () => {
  assert.deepEqual(
    PRACTICE_STAGES.map((stage) => stage.id),
    ["recognition", "supported-production", "semi-free-production", "free-response"],
  );
  assert.equal(HINT_LADDER.length, 5);
  assert.deepEqual(
    HINT_LADDER.map((hint) => hint.id),
    ["topic-cue", "keyword-cue", "phrase-frame", "forced-choice", "model-answer"],
  );
});

test("night practice session starts in recognition and advances one stage at a time", async () => {
  const practiceData = await readJson("../data/night-practice.json");
  const pack = practiceData.packs[0];
  const first = createNightPracticeSession(pack);
  const second = advanceNightPracticeSession(first);

  assert.equal(first.stageIndex, 0);
  assert.equal(first.stageId, "recognition");
  assert.equal(first.hintLevel, 0);
  assert.equal(second.stageIndex, 1);
  assert.equal(second.stageId, "supported-production");
  assert.equal(second.hintLevel, 0);
});

test("night practice hint ladder reveals one level at a time and resets on stage change", async () => {
  const practiceData = await readJson("../data/night-practice.json");
  const pack = practiceData.packs[0];
  const first = createNightPracticeSession(pack);
  const hinted = revealNextNightPracticeHint(revealNextNightPracticeHint(first));
  const advanced = advanceNightPracticeSession(hinted);

  assert.equal(hinted.hintLevel, 2);
  assert.equal(revealNextNightPracticeHint(setNightPracticeHintLevel(first, 5)).hintLevel, 5);
  assert.equal(advanced.stageId, "supported-production");
  assert.equal(advanced.hintLevel, 0);
});

test("night practice support builds topic, keyword, phrase, choice, and model cues for the active stage", async () => {
  const practiceData = await readJson("../data/night-practice.json");
  const pack = practiceData.packs[0];
  const session = setNightPracticeHintLevel(advanceNightPracticeSession(createNightPracticeSession(pack)), 5);
  const support = buildNightPracticeSupport(pack, session);

  assert.equal(support.stage.id, "supported-production");
  assert.match(support.topicCue, /scene|talk|discuss/i);
  assert.match(support.keywordCue, /Keyword cue: try to use/i);
  assert.match(support.phraseFrame, /Start with:/i);
  assert.match(support.forcedChoice, /\?/);
  assert.ok(support.modelAnswer.length > 12);
  assert.equal(support.currentHint.id, "model-answer");
});

test("stuck response rescue turns a pasted ChatGPT question into speakable replies", async () => {
  const practiceData = await readJson("../data/night-practice.json");
  const pack = practiceData.packs[0];
  const session = advanceNightPracticeSession(createNightPracticeSession(pack));
  const rescue = buildStuckResponseRescue(pack, session, "What made the team decision so difficult?");

  assert.equal(rescue.latestQuestion, "What made the team decision so difficult?");
  assert.ok(rescue.focusWords.length >= 1);
  assert.match(rescue.quickReply, /decision|situation|question/i);
  assert.match(rescue.targetReply, new RegExp(escapeRegExp(rescue.focusWords[0].term), "i"));
  assert.match(rescue.sentenceStarter, /^(I think|From my side|If I had)/i);
  assert.equal(rescue.choices.length, 2);
  assert.match(rescue.upgradedReply, /because/i);
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
