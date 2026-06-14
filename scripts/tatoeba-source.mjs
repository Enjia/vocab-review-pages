import { classifyExample, wordCount } from "./example-quality.mjs";

const TATOEBA_ENDPOINT = "https://tatoeba.org/en/api_v0/search";

export function normalizeTermForSearch(term) {
  return term.trim();
}

export function chooseTatoebaSentence(term, results) {
  const exactTermPattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");

  const candidates = results
    .filter((item) => item?.lang === "eng")
    .filter((item) => exactTermPattern.test(String(item.text || "")))
    .filter((item) => {
      const count = wordCount(item.text || "");
      return count >= 5 && count <= 24;
    })
    .filter((item) => !classifyExample({ term, example: item.text || "" }).isTemplate);

  if (!candidates.length) return null;

  return candidates.sort((a, b) => scoreSentence(term, b) - scoreSentence(term, a))[0];
}

export async function fetchTatoebaCandidates(term, fetchImpl = fetch) {
  const url = new URL(TATOEBA_ENDPOINT);
  url.searchParams.set("from", "eng");
  url.searchParams.set("query", normalizeTermForSearch(term));
  url.searchParams.set("orphans", "no");
  url.searchParams.set("sort", "relevance");

  const response = await fetchWithRetry(url, fetchImpl);
  if (!response.ok) {
    throw new Error(`Tatoeba request failed for ${term}: ${response.status}`);
  }

  const payload = await response.json();
  return payload.results || [];
}

async function fetchWithRetry(url, fetchImpl) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetchImpl(url);
    if (response.status !== 429) return response;
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }

  return fetchImpl(url);
}

function scoreSentence(term, item) {
  const text = String(item.text || "");
  const count = wordCount(text);
  let score = 100;

  if (item.license === "CC0 1.0") score += 20;
  if (count >= 8 && count <= 18) score += 12;
  if (new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text)) score += 10;
  if (/[.!?]$/.test(text.trim())) score += 5;
  if (text.length > 140) score -= 15;

  return score;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
