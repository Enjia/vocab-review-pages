export const PRACTICE_RESULT_OPTIONS = ["used", "prompted", "retry", "skipped"];

export function getNightPracticePack(packs, packId) {
  return packs.find((pack) => pack.id === packId) || packs[0] || null;
}

export function buildNightPracticePrompt(pack, { retryWordIds = [] } = {}) {
  const targetWords = pack.targetWords.map((word) => `- ${word.term}`).join("\n");
  const productionWords = selectProductionWords(pack.targetWords);
  const retryWords = pack.targetWords.filter((word) => retryWordIds.includes(word.entryId));
  const productionTargets = productionWords.length
    ? productionWords.map((word) => `- ${word.term}`).join("\n")
    : "- No mandatory production target for this pack. Keep the conversation natural.";

  return `Use this as a 15-minute spoken English role-play. You play ChatGPT. Ask me one question at a time and wait for my spoken answer.

15-minute routine:
- First 2 minutes: briefly set the scene and warm me up with simple, natural questions.
- Next 8 minutes: have a free spoken conversation in the scene. Keep the exchange natural instead of reading a script.
- Next 3 minutes: review my language. Do not correct every turn. Choose at most three high-value points, let me self-correct first, then give a concise upgrade.
- Final 2 minutes: ask me to retry one weak answer using the upgraded wording.

Conversation rules:
- Start with one short spoken question and wait for my answer.
- If I pause to think, wait until I say "your turn" or the pause is clearly longer than about eight seconds before offering help.
- Prioritise meaning, interaction, and intelligibility over tiny grammar mistakes.
- Do not use a prewritten dialogue script. Keep the exchange responsive to what I actually say.
- Use the production targets naturally, but do not force all target words into the conversation.

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

function getMostRecentResults(progress, packId) {
  const sessions = Object.values(progress || {})
    .filter((item) => item?.wordResults && (!packId || item.packId === packId || item.id === packId))
    .sort((left, right) => String(right.practicedAt || "").localeCompare(String(left.practicedAt || "")));

  return normalizePracticeResults(sessions[0]?.wordResults);
}
