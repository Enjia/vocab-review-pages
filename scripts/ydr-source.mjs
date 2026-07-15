const YDR_PAGE_ENDPOINT = "https://dict.youdao.com/w/";
const YDR_API_ENDPOINT = "https://api.yourdictionary.com/words";
const RESPONSE_TIMEOUT_MS = 15000;

const YDR_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

export async function fetchYDRSentenceCandidates(term, fetchImpl = defaultFetch) {
  const query = normalizeQuery(term);
  if (!query) return [];

  const pageCandidates = await fetchYoudaoPageCandidates(query, fetchImpl);
  if (pageCandidates.length > 0) return pageCandidates;

  // Keep the old API as fallback in case it is available in some locales.
  try {
    return await fetchOldYDRApiCandidates(query, fetchImpl);
  } catch (error) {
    if (error.name === "TypeError") {
      return [];
    }
    throw error;
  }
}

export function extractYDRSentenceCandidates(payload) {
  return extractSentences(payload);
}

async function fetchYoudaoPageCandidates(query, fetchImpl) {
  const response = await fetchImpl(`${YDR_PAGE_ENDPOINT}${encodeURIComponent(query)}/`, {
    headers: {
      "User-Agent": YDR_USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(RESPONSE_TIMEOUT_MS),
  });

  if (response.status === 404) return [];
  if (!response.ok) return [];

  const html = await response.text();
  return extractYoudaoPageSentences(html);
}

async function fetchOldYDRApiCandidates(query, fetchImpl) {
  const response = await fetchImpl(`${YDR_API_ENDPOINT}/${encodeURIComponent(query)}/sentences/`, {
    headers: {
      "User-Agent": YDR_USER_AGENT,
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(RESPONSE_TIMEOUT_MS),
  });

  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`YourDictionary request failed for ${query}: ${response.status}`);

  const payload = await response.json();
  return extractSentences(payload);
}

function extractYoudaoPageSentences(html) {
  const examplesStart = html.indexOf('id="examples"');
  const relevantHtml = examplesStart >= 0 ? html.slice(examplesStart, examplesStart + 220000) : html;
  const sentBlocks = [...relevantHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];

  const extracted = sentBlocks
    .map((match) => htmlToText(match[1]))
    .map(extractEnglishSentence)
    .filter(Boolean)
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value) => /[A-Za-z]/.test(value));

  return dedupeOrdered(extracted);
}

function htmlToText(value) {
  return decodeHtmlEntities(
    String(value)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function extractEnglishSentence(value) {
  const hanIndex = value.search(/[\u4e00-\u9fff]/);
  if (hanIndex >= 0) return value.slice(0, hanIndex).trim();
  return value.trim();
}

function extractSentences(payload) {
  const sentences = Array.isArray(payload?.data?.sentences) ? payload.data.sentences : [];
  const normalized = sentences
    .map((entry) => sanitizeText(entry?.sentence || entry?.text || ""))
    .filter((entry) => entry && /[A-Za-z]/.test(entry));

  return dedupeOrdered(normalized);
}

function normalizeQuery(value) {
  return String(value).replace(/[()]/g, " ").trim().replace(/\s+/g, "-").toLowerCase();
}

function sanitizeText(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function dedupeOrdered(values) {
  const seen = new Set();
  const next = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    next.push(value);
  }

  return next;
}

async function defaultFetch(url, options) {
  return fetch(url, options);
}
