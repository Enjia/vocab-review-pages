const FREEDICTIONARY_ENDPOINT = "https://freedictionaryapi.com/api/v1/entries/en/";
const RESPONSE_TIMEOUT_MS = 12000;

export async function fetchFreeDictionaryCandidates(term, fetchImpl = defaultFetch) {
  const query = normalizeQuery(term);
  if (!query) return [];

  const response = await fetchImpl(`${FREEDICTIONARY_ENDPOINT}${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(RESPONSE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`FreeDictionary request failed for ${term}: ${response.status}`);
  }

  const payload = await response.json();
  return extractCandidatesFromPayload(payload);
}

export function extractCandidatesFromPayload(payload) {
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  const examples = [];

  for (const entry of entries) {
    for (const sense of toArray(entry?.senses)) {
      for (const value of toArray(sense?.examples)) {
        collectFreeExample(value, examples);
      }

      for (const quote of toArray(sense?.quotes)) {
        collectFreeExample(quote, examples);
      }

      for (const subsense of toArray(sense?.subsenses)) {
        for (const value of toArray(subsense?.examples)) {
          collectFreeExample(value, examples);
        }
      }
    }
  }

  return dedupeOrdered(examples.map((value) => sanitizeText(value)).filter((value) => isLikelyEnglish(value)));
}

function collectFreeExample(example, out) {
  if (!example) return;

  if (typeof example === "string") {
    out.push(sanitizeText(example));
    return;
  }

  if (typeof example === "object") {
    for (const value of toArray(example.examples)) {
      collectFreeExample(value, out);
    }

    if (typeof example.text === "string") {
      out.push(sanitizeText(example.text));
    }

    if (typeof example.quote === "string") {
      out.push(sanitizeText(example.quote));
    }

    for (const value of toArray(example?.translations)) {
      collectFreeExample(value, out);
    }
  }
}

function isLikelyEnglish(value) {
  return /[A-Za-z]/.test(value) && !/[\p{Script=Han}]/u.test(value) && wordCount(value) >= 3;
}

function normalizeQuery(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function sanitizeText(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function toArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function dedupeOrdered(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

function wordCount(value) {
  return (String(value).match(/[A-Za-z]+(?:[-'][A-Za-z]+)?/g) || []).length;
}

async function defaultFetch(url, options) {
  return fetch(url, options);
}
