const OXFORD_ENDPOINT = "https://www.oxfordlearnersdictionaries.com/us/definition/english/";

const OXFORD_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

const RESPONSE_TIMEOUT_MS = 12000;

export async function fetchOxfordCandidates(term, fetchImpl = defaultFetch) {
  const query = normalizeQuery(term);
  const url = `${OXFORD_ENDPOINT}${encodeURIComponent(query)}`;
  const response = await fetchImpl(url, {
    headers: {
      "User-Agent": OXFORD_USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(RESPONSE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Oxford request failed for ${term}: ${response.status}`);
  }

  const html = await response.text();
  return extractExamplesFromHtml(html);
}

export function extractOxfordExamples(rawHtml) {
  return extractExamplesFromHtml(rawHtml);
}

function extractExamplesFromHtml(html) {
  const blocks = [...html.matchAll(/<ul[^>]*class=\"examples\"[^>]*>([\s\S]*?)<\/ul>/g)];
  if (!blocks.length) return [];

  const collected = [];
  const sentenceRe = /<span[^>]*class=\"x\">([\s\S]*?)<\/span>/g;

  for (const block of blocks) {
    let match;
    while ((match = sentenceRe.exec(block[1])) !== null) {
      const cleaned = htmlToText(match[1]);
      if (!cleaned) continue;
      collected.push(cleaned);
    }
  }

  return dedupeOrdered(collected);
}

function htmlToText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, `"`)
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function normalizeQuery(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

async function defaultFetch(url, options) {
  return fetch(url, options);
}

function dedupeOrdered(values) {
  const seen = new Set();
  const next = [];
  for (const value of values) {
    const current = String(value).replace(/\s+/g, " ").trim();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    next.push(current);
  }
  return next;
}
