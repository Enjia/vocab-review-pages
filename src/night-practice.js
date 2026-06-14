export function getNightPracticePack(packs, packId) {
  return packs.find((pack) => pack.id === packId) || packs[0] || null;
}

export function buildNightPracticePrompt(pack) {
  const targetWords = pack.targetWords.map((word) => `- ${word.term}`).join("\n");
  const turns = pack.turns
    .map((turn, index) => `${index + 1}. User: ${turn.user}\n   ChatGPT: ${turn.chatgpt}`)
    .join("\n\n");

  return `Use this as a spoken English role-play. You play ChatGPT. Ask me one question at a time, wait for my spoken answer, then give a short correction or upgrade before continuing.

Scene:
${pack.scene}

Target words:
${targetWords}

Dialogue script:
${turns}

When we finish, summarize which target words I used well and which ones I should retry.`;
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
