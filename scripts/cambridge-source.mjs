const CAMBRIDGE_ENDPOINT = "https://dictionary.cambridge.org/us/dictionary/english/";

const RESPONSE_TIMEOUT_MS = 12000;

export async function fetchCambridgeCandidates(term, fetchImpl = defaultFetch) {
  const query = normalizeQuery(term);
  if (!query) return [];

  const response = await fetchImpl(`${CAMBRIDGE_ENDPOINT}${encodeURIComponent(query)}`, {
    headers: {
      "User-Agent": CAMBRIDGE_USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(RESPONSE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Cambridge request failed for ${term}: ${response.status}`);
  }

  const html = await response.text();
  return extractExamplesFromHtml(html);
}

export function extractCambridgeCandidates(rawHtml) {
  return extractExamplesFromHtml(rawHtml);
}

function extractExamplesFromHtml(html) {
  const regex = /<li[^>]*\bclass=\"[^\"]*\beg\b[^\"]*\"[^>]*>([\s\S]*?)<\/li>/g;
  const fallback = /<div[^>]*\bclass=\"[^\"]*\beg\b[^\"]*\"[^>]*>([\s\S]*?)<\/div>/g;

  const collected = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    const cleaned = htmlToText(match[1]);
    if (cleaned) collected.push(cleaned);
  }

  if (collected.length === 0) {
    while ((match = fallback.exec(html)) !== null) {
      const cleaned = htmlToText(match[1]);
      if (cleaned) collected.push(cleaned);
    }
  }

  return dedupeOrdered(collected);
}

function htmlToText(value) {
  return decodeHtmlEntities(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s+([.,!?;:'])/g, "$1")
      .trim(),
  );
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

const CAMBRIDGE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

function normalizeQuery(value) {
  return String(value).trim().toLowerCase().replace(/[\\s_]+/g, "-");
}

function dedupeOrdered(values) {
  const seen = new Set();
  const next = [];
  for (const value of values) {
    const normalized = String(value).replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }
  return next;
}

async function defaultFetch(url, options) {
  return fetch(url, options);
}
