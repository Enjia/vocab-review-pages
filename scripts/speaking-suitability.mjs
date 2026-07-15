const CAUTION_TERMS = new Set([
  "a bratty kid",
  "a drinking bout",
  "a spoiled/spoilt brat",
  "bastard",
  "ghetto",
  "half-assed",
  "hell-bent",
  "hellish",
  "helluva",
  "madhouse",
  "retarded",
  "sex offender",
  "sexist",
  "sexual aberration",
  "sexual intercourse",
  "whoredom",
  "work your ass off",
]);

const RECOGNITION_TERMS = new Set([
  "a child reared on self-indulgence",
  "a few husks of reason",
  "bleated feebly",
]);

export function classifySpeakingSuitability(entry) {
  const term = cleanTerm(entry?.term);
  if (!term) return "recognition";
  if (CAUTION_TERMS.has(term)) return "caution";
  if (RECOGNITION_TERMS.has(term)) return "recognition";
  if (isTemplate(entry, term) || hasNoUsableExample(entry) || wordCount(term) >= 7) return "recognition";
  return "active";
}

export function summarizeSpeakingSuitability(entries) {
  const counts = { active: 0, recognition: 0, caution: 0 };
  for (const entry of entries || []) {
    const suitability = entry.speakingSuitability || classifySpeakingSuitability(entry);
    counts[suitability] += 1;
  }
  return counts;
}

function cleanTerm(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isTemplate(entry, term) {
  return (
    /[(){}]|\//.test(term) ||
    /\b(?:sb|sth|somebody|someone|something)\b/i.test(term) ||
    String(entry?.sourcePath || "").includes("句式模板")
  );
}

function hasNoUsableExample(entry) {
  if (!Array.isArray(entry?.examples)) return false;
  return !entry.examples.some((example) => String(example?.en || "").trim());
}

function wordCount(term) {
  return term.split(/[\s-]+/).filter(Boolean).length;
}
