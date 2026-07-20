export const PRACTICE_RESULT_OPTIONS = ["used", "prompted", "retry", "skipped"];

export const PRACTICE_STAGES = [
  {
    id: "recognition",
    label: "Recognition",
    minutes: "2 min",
    description: "Warm up with simple recall before you try to build longer answers.",
  },
  {
    id: "supported-production",
    label: "Supported production",
    minutes: "4 min",
    description: "Use one target phrase at a time with direct support and short follow-up questions.",
  },
  {
    id: "semi-free-production",
    label: "Semi-free production",
    minutes: "4 min",
    description: "Stay in the same scene, but answer with less support and combine more than one target item.",
  },
  {
    id: "free-response",
    label: "Free response",
    minutes: "3 min",
    description: "Summarize the whole situation with minimal support and your own wording.",
  },
];

export const HINT_LADDER = [
  { id: "topic-cue", label: "Hint 1", shortLabel: "Topic cue" },
  { id: "keyword-cue", label: "Hint 2", shortLabel: "Keyword cue" },
  { id: "phrase-frame", label: "Hint 3", shortLabel: "Phrase frame" },
  { id: "forced-choice", label: "Hint 4", shortLabel: "Forced choice" },
  { id: "model-answer", label: "Hint 5", shortLabel: "Model answer" },
];

const STAGE_FRAME_MAP = {
  recognition: 'Start with: "The situation sounds ..."',
  "supported-production": 'Start with: "I think we are dealing with ..."',
  "semi-free-production": 'Start with: "From my side, ... and that means ..."',
  "free-response": 'Start with: "If I had to sum it up, ..."',
};

export function getNightPracticePack(packs, packId) {
  return packs.find((pack) => pack.id === packId) || packs[0] || null;
}

export function createNightPracticeSession(pack, saved = {}) {
  const stageIndex = clampInteger(saved.stageIndex, 0, PRACTICE_STAGES.length - 1);
  const hintLevel = clampInteger(saved.hintLevel, 0, HINT_LADDER.length);
  const stage = PRACTICE_STAGES[stageIndex];
  return {
    packId: pack?.id || saved.packId || "",
    stageIndex,
    stageId: stage.id,
    hintLevel,
    updatedAt: saved.updatedAt || "",
    completed: stageIndex === PRACTICE_STAGES.length - 1,
  };
}

export function advanceNightPracticeSession(session) {
  return createNightPracticeSession(
    { id: session.packId },
    {
      ...session,
      stageIndex: Math.min(session.stageIndex + 1, PRACTICE_STAGES.length - 1),
      hintLevel: 0,
    },
  );
}

export function setNightPracticeHintLevel(session, hintLevel) {
  return createNightPracticeSession(
    { id: session.packId },
    {
      ...session,
      hintLevel: clampInteger(hintLevel, 0, HINT_LADDER.length),
    },
  );
}

export function revealNextNightPracticeHint(session) {
  return setNightPracticeHintLevel(session, session.hintLevel + 1);
}

export function getNightPracticeStageTurns(pack, session) {
  const turns = Array.isArray(pack?.turns) ? pack.turns : [];
  if (!turns.length) return [];
  const chunks = splitIntoStageChunks(turns, PRACTICE_STAGES.length);
  return chunks[session.stageIndex] || [];
}

export function buildNightPracticeSupport(pack, session) {
  const stage = PRACTICE_STAGES[session.stageIndex] || PRACTICE_STAGES[0];
  const focusWords = getFocusWords(pack, session);
  const stageTurns = getNightPracticeStageTurns(pack, session);
  const topicCue = buildTopicCue(pack, stage, focusWords);
  const keywordCue = buildKeywordCue(focusWords);
  const phraseFrame = STAGE_FRAME_MAP[stage.id];
  const forcedChoice = buildForcedChoice(focusWords, pack);
  const modelAnswer = buildModelAnswer(stageTurns);
  const hintTexts = [topicCue, keywordCue, phraseFrame, forcedChoice, modelAnswer];
  const currentHint = session.hintLevel > 0
    ? {
        ...HINT_LADDER[session.hintLevel - 1],
        text: hintTexts[session.hintLevel - 1],
      }
    : null;

  return {
    stage,
    focusWords,
    stageTurns,
    topicCue,
    keywordCue,
    phraseFrame,
    forcedChoice,
    modelAnswer,
    currentHint,
    hintCards: HINT_LADDER.map((hint, index) => ({
      ...hint,
      text: hintTexts[index],
      active: session.hintLevel === index + 1,
      revealed: session.hintLevel >= index + 1,
    })),
  };
}

export function buildStuckResponseRescue(pack, session, latestQuestion = "") {
  const support = buildNightPracticeSupport(pack, session);
  const focusWords = support.focusWords.length ? support.focusWords : (pack?.targetWords || []).slice(0, 2);
  const primaryTerm = focusWords[0]?.term || "this point";
  const secondaryTerm = focusWords[1]?.term || primaryTerm;
  const cleanedQuestion = normalizeQuestion(latestQuestion);
  const questionNoun = inferQuestionNoun(cleanedQuestion);
  const starter = support.phraseFrame.replace(/^Start with:\s*/i, "").replace(/^"|"$/g, "");

  return {
    latestQuestion: cleanedQuestion,
    focusWords,
    quickReply: `That's a difficult question. I think the main ${questionNoun} is the situation itself.`,
    targetReply: `I would connect this with "${primaryTerm}" because it captures the pressure in the situation.`,
    sentenceStarter: starter,
    choices: [
      `I can answer with "${primaryTerm}" and keep it simple.`,
      `I can compare it with "${secondaryTerm}" and explain the trade-off.`,
    ],
    upgradedReply: `I think the key point is "${primaryTerm}", because the situation is not just difficult; it also forces people to choose under pressure.`,
  };
}

export function buildNightPracticePrompt(pack, { retryWordIds = [], session = createNightPracticeSession(pack) } = {}) {
  const targetWords = pack.targetWords.map((word) => `- ${word.term}`).join("\n");
  const productionWords = selectProductionWords(pack.targetWords);
  const retryWords = pack.targetWords.filter((word) => retryWordIds.includes(word.entryId));
  const productionTargets = productionWords.length
    ? productionWords.map((word) => `- ${word.term}`).join("\n")
    : "- No mandatory production target for this pack. Keep the conversation natural.";
  const support = buildNightPracticeSupport(pack, session);

  return `Use this as a 15-minute spoken English role-play. You play ChatGPT. Ask me one question at a time and wait for my spoken answer.

Practice flow:
- Recognition (about 2 minutes): warm me up with concrete questions before expecting full production.
- Supported production (about 4 minutes): ask for one target phrase at a time with strong support.
- Semi-free production (about 4 minutes): keep the same scene but remove one support layer and ask me to connect ideas.
- Free response (about 3 minutes): ask me to summarize the situation in my own words with minimal support.
- Final 2 minutes: give a short recap, then ask me to retry one weak answer using the upgraded wording.

Hint ladder:
- Hint 1: topic cue
- Hint 2: keyword cue
- Hint 3: phrase frame
- Hint 4: forced choice
- Hint 5: model answer

Conversation rules:
- Start with one short spoken question and wait for my answer.
- If I pause to think, wait until I say "your turn" or the pause is clearly longer than about eight seconds before offering help.
- Do not jump straight to the answer when I freeze. Use only one hint level at a time.
- When I say "Hint 1", "Hint 2", "Hint 3", "Hint 4", or "Hint 5", respond with only that level.
- Prioritise meaning, interaction, and intelligibility over tiny grammar mistakes.
- Keep the exchange responsive to what I actually say.
- Use the production targets naturally, but do not force all target words into the conversation.
- After every 3-4 learner turns, give one brief correction and continue.

Current stage:
- ${support.stage.label}
- Current focus words: ${support.focusWords.length ? support.focusWords.map((word) => word.term).join(", ") : "Keep the opening relaxed and concrete."}

Scene:
${pack.scene}

Production targets (ask me to use these naturally):
${productionTargets}

Reference vocabulary:
${targetWords}

${retryWords.length ? `Retry words from my last attempt:\n${retryWords.map((word) => `- ${word.term}`).join("\n")}\n` : ""}

When we finish, summarize which production targets I used naturally, which needed a hint, and which I should retry tomorrow.`;
}

export function normalizePracticeResults(results) {
  if (!results || typeof results !== "object") return {};
  return Object.fromEntries(
    Object.entries(results).filter(([, result]) => PRACTICE_RESULT_OPTIONS.includes(result)),
  );
}

export function getRetryWordIds(progress, pack, limit = 3) {
  const recentResults = getMostRecentResults(progress, pack?.id);
  const priorities = new Map([
    ["retry", 0],
    ["skipped", 1],
    ["prompted", 2],
    ["used", 3],
  ]);

  return (pack?.targetWords || [])
    .map((word, index) => ({ id: word.entryId, index, result: recentResults[word.entryId] }))
    .filter((word) => word.result && word.result !== "used")
    .sort((left, right) => (priorities.get(left.result) - priorities.get(right.result)) || left.index - right.index)
    .slice(0, limit)
    .map((word) => word.id);
}

export function selectProductionWords(words, limit = 4) {
  return (words || []).filter((word) => word.speakingSuitability === "active").slice(0, limit);
}

export function validateNightPracticePack(pack, entryIds = new Set()) {
  const errors = [];
  if (!pack.id) errors.push("missing id");
  if (!pack.title) errors.push("missing title");
  if (!pack.scene) errors.push("missing scene");
  if (!Array.isArray(pack.targetWords) || pack.targetWords.length < 10 || pack.targetWords.length > 12) {
    errors.push("targetWords must contain 10-12 words");
  }
  if (!Array.isArray(pack.turns) || pack.turns.length < 25 || pack.turns.length > 30) {
    errors.push("turns must contain 25-30 items");
  }

  for (const word of pack.targetWords || []) {
    if (!word.entryId || !entryIds.has(word.entryId)) {
      errors.push(`unknown entry id: ${word.entryId || word.term}`);
    }
  }

  for (const [index, turn] of (pack.turns || []).entries()) {
    if (!turn.user || !turn.chatgpt) errors.push(`turn ${index + 1} is incomplete`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function loadNightPracticeProgress() {
  try {
    return JSON.parse(localStorage.getItem("vocab-night-practice-progress") || "{}");
  } catch {
    return {};
  }
}

export function saveNightPracticeProgress(progress) {
  try {
    localStorage.setItem("vocab-night-practice-progress", JSON.stringify(progress));
  } catch {
    // Progress remains in memory for storage-restricted browsers.
  }
}

export function loadNightPracticeSessions() {
  try {
    return JSON.parse(localStorage.getItem("vocab-night-practice-sessions") || "{}");
  } catch {
    return {};
  }
}

export function saveNightPracticeSessions(sessions) {
  try {
    localStorage.setItem("vocab-night-practice-sessions", JSON.stringify(sessions));
  } catch {
    // Session state remains in memory for storage-restricted browsers.
  }
}

function getMostRecentResults(progress, packId) {
  const sessions = Object.values(progress || {})
    .filter((item) => item?.wordResults && (!packId || item.packId === packId || item.id === packId))
    .sort((left, right) => String(right.practicedAt || "").localeCompare(String(left.practicedAt || "")));

  return normalizePracticeResults(sessions[0]?.wordResults);
}

function getFocusWords(pack, session) {
  const productionWords = selectProductionWords(pack?.targetWords || [], 4);
  const pool = productionWords.length ? productionWords : (pack?.targetWords || []).slice(0, 4);
  const stageFocusCounts = [1, 2, 3, Math.min(4, pool.length || 1)];
  const focusCount = stageFocusCounts[session.stageIndex] || 1;
  return pool.slice(0, focusCount);
}

function buildTopicCue(pack, stage, focusWords) {
  const lead = focusWords.length
    ? `Talk about the scene and steer toward ${focusWords.map((word) => word.term).join(", ")}.`
    : "Talk about the scene in short, concrete language.";
  return `Topic cue: ${lead} Keep it in the ${stage.label.toLowerCase()} stage of the same discussion.`;
}

function buildKeywordCue(focusWords) {
  if (!focusWords.length) return "Keyword cue: reuse one important phrase from the pack.";
  return `Keyword cue: try to use ${focusWords.map((word) => word.term).join(", ")}.`;
}

function buildForcedChoice(focusWords, pack) {
  const fallback = (pack?.targetWords || []).slice(0, 2);
  const choices = [...focusWords, ...fallback].slice(0, 2).map((word) => word.term);
  if (choices.length < 2) {
    return `Forced choice: do you want to answer with "${choices[0] || "one target phrase"}" or a simpler paraphrase first?`;
  }
  return `Forced choice: do you want to build your next answer around "${choices[0]}" or "${choices[1]}"?`;
}

function buildModelAnswer(stageTurns) {
  const modelTurn = stageTurns.find((turn) => turn?.user)?.user || "I think the problem is manageable, but we need a calmer plan.";
  return `Model answer: ${modelTurn}`;
}

function normalizeQuestion(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text || "What should I say next?";
}

function inferQuestionNoun(question) {
  const lower = question.toLowerCase();
  if (lower.includes("decision") || lower.includes("choose") || lower.includes("choice")) return "decision";
  if (lower.includes("feel") || lower.includes("react")) return "reaction";
  if (lower.includes("problem") || lower.includes("issue")) return "issue";
  if (lower.includes("why") || lower.includes("what")) return "question";
  return "situation";
}

function splitIntoStageChunks(items, chunkCount) {
  const result = [];
  const total = items.length;
  let start = 0;
  for (let index = 0; index < chunkCount; index += 1) {
    const end = Math.round(((index + 1) * total) / chunkCount);
    result.push(items.slice(start, end));
    start = end;
  }
  return result;
}

function clampInteger(value, min, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}
