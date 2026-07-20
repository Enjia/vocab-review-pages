import { sanitizeExamples } from "./example-quality.mjs";

export function pickBestBilingualCandidate({ term, currentExampleEn = "", candidates = [] }) {
  const relevant = candidates.filter((candidate) =>
    sanitizeExamples({
      term,
      examples: [candidate],
    }).length > 0,
  );

  const pool = relevant.length ? relevant : [];
  if (!pool.length) return null;

  const normalizedCurrent = normalizeSentence(currentExampleEn);
  if (normalizedCurrent) {
    const exact = pool.find((candidate) => normalizeSentence(candidate.en) === normalizedCurrent);
    if (exact) return exact;

    const ranked = pool
      .map((candidate) => ({
        candidate,
        score: sentenceSimilarity(currentExampleEn, candidate.en),
      }))
      .sort((a, b) => b.score - a.score);

    if (ranked[0]?.score >= 0.55) return ranked[0].candidate;
  }

  return pool[0];
}

function sentenceSimilarity(left, right) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (!leftTokens.size || !rightTokens.size) return 0;

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }

  const denominator = Math.max(leftTokens.size, rightTokens.size);
  return denominator ? overlap / denominator : 0;
}

function tokenize(value) {
  return normalizeSentence(value)
    .match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || [];
}

function normalizeSentence(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[“”"'’]/g, "")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
