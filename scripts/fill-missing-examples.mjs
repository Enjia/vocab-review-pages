import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  sanitizeExamples,
  wordCount,
  isRelevantExample,
  classifyExample,
} from "./example-quality.mjs";
import { chooseTatoebaSentence, fetchTatoebaCandidates } from "./tatoeba-source.mjs";
import { fetchOxfordCandidates } from "./oxford-source.mjs";
import { fetchPearsonCandidates } from "./pearson-source.mjs";
import { fetchFreeDictionaryCandidates } from "./freedictionary-source.mjs";
import { fetchCambridgeCandidates } from "./cambridge-source.mjs";
import { fetchYDRSentenceCandidates } from "./ydr-source.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wordsPath = process.env.VOCAB_WORDS_PATH || path.join(projectRoot, "data", "words.json");
const cachePath = process.env.VOCAB_EXAMPLE_CACHE_PATH || path.join(projectRoot, "data", "example-enrichment-cache.json");
const reportPath = process.env.VOCAB_EXAMPLE_ENRICH_REPORT || path.join(projectRoot, "data", "example-enrichment-report.json");
const tatoebaCachePath = process.env.VOCAB_TATOEBA_CACHE_PATH || path.join(projectRoot, "tatoeba-cache.json");
const oxfordCachePath = process.env.VOCAB_OXFORD_CACHE_PATH || path.join(projectRoot, "oxford-cache.json");
const pearsonCachePath = process.env.VOCAB_PEARSON_CACHE_PATH || path.join(projectRoot, "pearson-cache.json");
const freeDictionaryCachePath =
  process.env.VOCAB_FREEDICTIONARY_CACHE_PATH || path.join(projectRoot, "freedictionary-cache.json");
const cambridgeCachePath =
  process.env.VOCAB_CAMBRIDGE_CACHE_PATH || path.join(projectRoot, "cambridge-cache.json");
const ydrCachePath = process.env.VOCAB_YDR_CACHE_PATH || path.join(projectRoot, "ydr-cache.json");

const CONCURRENCY = Number(process.env.VOCAB_EXAMPLE_CONCURRENCY || 6);
const RETRY_ATTEMPTS = Number(process.env.VOCAB_EXAMPLE_RETRIES || 3);
const REQUEST_TIMEOUT_MS = Number(process.env.VOCAB_EXAMPLE_TIMEOUT_MS || 12000);
const CACHE_FLUSH_INTERVAL = Number(process.env.VOCAB_EXAMPLE_FLUSH_INTERVAL || 200);
const DICTIONARY_ENDPOINT = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const FORCE_REFRESH = process.env.VOCAB_FORCE_REFRESH_MISSING === "1";
const DICTIONARY_QUERY_LIMIT = 6;
const DICTIONARY_KEYWORD_QUERY_LIMIT = 5;
const TATOEBA_QUERY_LIMIT = 8;
const TATOEBA_KEYWORD_QUERY_LIMIT = 8;
const VERBOSE_PROGRESS = process.env.VOCAB_VERBOSE_PROGRESS === "1";
const TATOEBA_QUERY_DELAY_MS = Number(process.env.VOCAB_TATOEBA_DELAY_MS || 250);
const TATOEBA_FALLBACK_QUERY_LIMIT = 12;
const OXFORD_QUERY_DELAY_MS = Number(process.env.VOCAB_OXFORD_DELAY_MS || 350);
const PEARSON_QUERY_DELAY_MS = Number(process.env.VOCAB_PEARSON_QUERY_DELAY_MS || 240);
const FREEDICTIONARY_QUERY_DELAY_MS = Number(process.env.VOCAB_FREE_DICTIONARY_DELAY_MS || 220);
const CAMBRIDGE_QUERY_DELAY_MS = Number(process.env.VOCAB_CAMBRIDGE_DELAY_MS || 260);
const YDR_QUERY_DELAY_MS = Number(process.env.VOCAB_YDR_DELAY_MS || 240);

const STOP_WORDS = new Set([
  "and",
  "a",
  "an",
  "the",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "by",
  "with",
  "as",
  "is",
  "are",
  "was",
  "were",
  "it",
  "its",
  "into",
  "that",
  "them",
  "their",
  "there",
  "from",
  "or",
  "your",
  "off",
]);

const TERM_ALIAS_MAP = {
  altruistical: ["altruistic"],
  antichoice: ["anti-choice", "anti choice"],
  balkaniz: ["balkanize", "balkanisation", "balkanization"],
  bellygod: ["belly god"],
  "be on the go": ["on the go"],
  clearsighted: ["clear-sighted", "clear sighted"],
  colporteur: ["colporter"],
  excathedral: ["ex cathedra"],
  fantasm: ["phantasm"],
  hybris: ["hubris"],
  imprecatory: ["imprecation"],
  inclusio: ["inclusion"],
  indeterminat: ["indeterminate"],
  McJobs: ["mcjob", "mc job", "mc-jobs"],
  menigitis: ["meningitis"],
  mudslingin: ["mudslinging"],
  muleheaded: ["mulish", "stubborn as a mule"],
  odiousness: ["odious"],
  osteoporoses: ["osteoporosis"],
  overscrupulous: ["over-scrupulous", "over scrupulous"],
  proabortion: ["pro-abortion", "pro abortion"],
  nepotists: ["nepotist", "nepotism"],
  skeletonise: ["skeletonize", "skeletonization"],
  Trisagion: ["trisagion"],
  wouldbe: ["would-be", "would be"],
  想: ["phony", "phonies"],
};

const MANUAL_EXAMPLE_FALLBACKS = {
  "be on the go": "Like most working mothers, she is always on the go.",
  "a bee in one's bonnet": "He's got a bee in his bonnet about factory farming.",
  colporteur:
    "A colporteur was reading the parable of the Prodigal Son in a Paris cafe much frequented by North African workmen.",
  ethicist: "As a physician and ethicist, I am a strong advocate of vaccination.",
  fantasm: "The ghost he saw was just a fantasm.",
  imprecatory: "The imprecatory psalms are a tremendous source of comfort.",
  infovore: "Finding a new word in an article is a real treat for an infovore.",
  kerygma: "We spoke about some practicalities in sharing the Kerygma.",
  nepotists: "The nepotists themselves hate it because it gets thrown in their face constantly.",
  想: "He gave a phony name to the police.",
};

const payload = JSON.parse(await fs.readFile(wordsPath, "utf8"));
const entries = payload.entries || [];
const beforeMissing = entries.filter((entry) => !entry.examples?.length).length;

const cache = await readJson(cachePath, {});
const tatoebaCache = await readJson(tatoebaCachePath, {});
const oxfordCache = await readJson(oxfordCachePath, {});
const pearsonCache = await readJson(pearsonCachePath, {});
const freeDictionaryCache = await readJson(freeDictionaryCachePath, {});
const cambridgeCache = await readJson(cambridgeCachePath, {});
const ydrCache = await readJson(ydrCachePath, {});

const report = {
  generatedAt: new Date().toISOString(),
  source: "dictionaryapi.dev + oxford + pearson + free dictionary + cambridge + ydr + tatoeba",
  totalEntries: entries.length,
  beforeMissing,
  afterMissing: null,
  enriched: 0,
  bySource: {
    dictionary: 0,
    tatoeba: 0,
    oxford: 0,
    pearson: 0,
    freedictionary: 0,
    cambridge: 0,
    ydr: 0,
    fallback: 0,
  },
  misses: [],
  details: [],
};

const missingTermMap = new Map();
for (const entry of entries) {
  if (entry.examples?.length) continue;
  const key = normalize(entry.term);
  if (!missingTermMap.has(key)) missingTermMap.set(key, entry.term);
}

const uniqueTerms = [...missingTermMap.keys()];
console.log(`enriching ${uniqueTerms.length} unique terms (from ${beforeMissing} missing entries), concurrency: ${CONCURRENCY}`);

let processed = 0;
await mapLimit(uniqueTerms, CONCURRENCY, async (queryKey) => {
  if (Object.prototype.hasOwnProperty.call(cache, queryKey)) {
    if (FORCE_REFRESH) {
      delete cache[queryKey];
    } else if (cache[queryKey] !== null) {
      return;
    } else {
      delete cache[queryKey];
    }
  }
  const term = missingTermMap.get(queryKey);
  const resolved = await resolveExample(term);
  cache[queryKey] = resolved;

  processed += 1;
  if (processed % CACHE_FLUSH_INTERVAL === 0) {
    await persistJson(cachePath, cache);
  }

  if (processed % 50 === 0 || processed === uniqueTerms.length) {
    console.log(`fetch progress: ${processed}/${uniqueTerms.length}`);
  }

  if (VERBOSE_PROGRESS && processed % 10 === 0) {
    console.log(`resolved term=${term}, source=${resolved?.source ?? "none"}`);
  }
});
await persistJson(cachePath, cache);

const finalByKey = new Map(Object.entries(cache));
  for (const entry of entries) {
    if (entry.examples?.length) continue;
    const key = normalize(entry.term);
    const resolved = finalByKey.get(key);

  if (!resolved) {
    report.misses.push({
      term: entry.term,
      reason: "no-remote-example-found",
      sourcePath: entry.sourcePath,
    });
    continue;
  }

  const aliases = getAliasTerms(entry.term);
  const examples = sanitizeExamplesWithAliases(entry.term, resolved.example, aliases);
  if (!examples.length) {
    const fallback = relaxedCandidate(entry.term, resolved.example, aliases);
    if (!fallback) {
      report.misses.push({
        term: entry.term,
        reason: "low-quality-candidate",
        sourcePath: entry.sourcePath,
      });
      continue;
    }

    examples.push({
      en: resolved.example,
      zh: "",
    });
  }

  if (!examples.length) {
    report.misses.push({
      term: entry.term,
      reason: "low-quality-candidate",
      sourcePath: entry.sourcePath,
    });
    continue;
  }

  entry.examples = examples;
  report.enriched += 1;
  report.bySource[resolved.source] = (report.bySource[resolved.source] || 0) + 1;
  report.details.push({
    term: entry.term,
    source: resolved.source,
    sourcePath: entry.sourcePath,
    example: examples[0].en,
  });
}

report.afterMissing = entries.filter((entry) => !entry.examples?.length).length;
payload.entries = entries;
payload.count = entries.length;
payload.lastExampleEnrichment = report.generatedAt;
await fs.writeFile(wordsPath, JSON.stringify(payload, null, 2), "utf8");
await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

console.log(
  JSON.stringify(
    {
      beforeMissing,
      afterMissing: report.afterMissing,
      enriched: report.enriched,
      misses: report.misses.length,
      bySource: report.bySource,
    },
    null,
    2,
  ),
);

async function resolveExample(term) {
  const aliases = getAliasTerms(term);
  const dictionaryQueries = buildDictionaryQueriesForTerm(term, DICTIONARY_QUERY_LIMIT);
  for (const query of dictionaryQueries) {
    const dictionaryCandidate = await fetchDictionaryExample(query, {
      term,
      termAliases: aliases,
      forceRefresh: FORCE_REFRESH,
      requiredMatches: Math.min(extractSignificantWords(term).length, 2) || 1,
      relaxed: false,
    });
    if (isUsableCandidate(term, dictionaryCandidate, aliases)) {
      return {
        source: "dictionary",
        example: dictionaryCandidate,
      };
    }
  }

  for (const query of dictionaryQueries) {
    const dictionaryCandidate = await fetchDictionaryExample(query, {
      term,
      termAliases: aliases,
      forceRefresh: FORCE_REFRESH,
      requiredMatches: 1,
      relaxed: true,
      allowTemplates: true,
    });
    if (isUsableCandidate(term, dictionaryCandidate, aliases)) {
      return {
        source: "dictionary",
        example: dictionaryCandidate,
      };
    }
  }

  const freeDictionaryQueries = buildFreeDictionaryQueriesForTerm(term, DICTIONARY_QUERY_LIMIT);
  for (const query of freeDictionaryQueries) {
    const freeDictionaryCandidate = await fetchFreeDictionaryExample(query, {
      term,
      termAliases: aliases,
      forceRefresh: FORCE_REFRESH,
      requiredMatches: Math.min(extractSignificantWords(term).length, 2) || 1,
      relaxed: false,
    });

    if (isUsableCandidate(term, freeDictionaryCandidate, aliases)) {
      return {
        source: "freedictionary",
        example: freeDictionaryCandidate,
      };
    }
  }

  for (const query of freeDictionaryQueries) {
    const freeDictionaryCandidate = await fetchFreeDictionaryExample(query, {
      term,
      termAliases: aliases,
      forceRefresh: FORCE_REFRESH,
      requiredMatches: 1,
      relaxed: true,
      allowTemplates: true,
    });

    if (isUsableCandidate(term, freeDictionaryCandidate, aliases)) {
      return {
        source: "freedictionary",
        example: freeDictionaryCandidate,
      };
    }
  }

  const oxfordQueries = buildOxfordQueriesForTerm(term, 10);
  for (const query of oxfordQueries) {
    const selected = await fetchOxfordExample(term, query, {
      forceRefresh: FORCE_REFRESH,
      minWords: 4,
      relaxed: false,
      allowTemplates: false,
      termAliases: aliases,
    });
    if (isUsableCandidate(term, selected, aliases)) {
      return {
        source: "oxford",
        example: selected,
      };
    }
  }

  for (const query of oxfordQueries) {
    const selected = await fetchOxfordExample(term, query, {
      forceRefresh: FORCE_REFRESH,
      minWords: 3,
      relaxed: true,
      allowTemplates: false,
      termAliases: aliases,
    });
    if (isUsableCandidate(term, selected, aliases)) {
      return {
        source: "oxford",
        example: selected,
      };
    }
  }

  const pearsonQueries = buildPearsonQueriesForTerm(term, 10);
  for (const query of pearsonQueries) {
    const selected = await fetchPearsonExample(query, {
      term,
      minWords: 4,
      relaxed: false,
      forceRefresh: FORCE_REFRESH,
      requiredMatches: Math.min(extractSignificantWords(term).length, 2) || 1,
      termAliases: aliases,
    });
    if (isUsableCandidate(term, selected, aliases)) {
      return {
        source: "pearson",
        example: selected,
      };
    }
  }

  for (const query of pearsonQueries) {
    const selected = await fetchPearsonExample(query, {
      term,
      minWords: 3,
      relaxed: true,
      requiredMatches: 1,
      allowTemplates: true,
      forceRefresh: FORCE_REFRESH,
      termAliases: aliases,
    });
    if (isUsableCandidate(term, selected, aliases)) {
      return {
        source: "pearson",
        example: selected,
      };
    }
  }

  const cambridgeQueries = buildCambridgeQueriesForTerm(term, 12);
  for (const query of cambridgeQueries) {
    const selected = await fetchCambridgeExample(query, {
      term,
      minWords: 4,
      relaxed: false,
      requiredMatches: Math.min(extractSignificantWords(term).length, 2) || 1,
      forceRefresh: FORCE_REFRESH,
      termAliases: aliases,
    });
    if (isUsableCandidate(term, selected, aliases)) {
      return {
        source: "cambridge",
        example: selected,
      };
    }
  }

  for (const query of cambridgeQueries) {
    const selected = await fetchCambridgeExample(query, {
      term,
      minWords: 3,
      relaxed: true,
      requiredMatches: 1,
      allowTemplates: false,
      forceRefresh: FORCE_REFRESH,
      termAliases: aliases,
    });
    if (isUsableCandidate(term, selected, aliases)) {
      return {
        source: "cambridge",
        example: selected,
      };
    }
  }

  const ydrQueries = buildYdrQueriesForTerm(term, 12);
  for (const query of ydrQueries) {
    const selected = await fetchYdrExample(query, {
      term,
      minWords: 4,
      relaxed: false,
      requiredMatches: Math.min(extractSignificantWords(term).length, 2) || 1,
      forceRefresh: FORCE_REFRESH,
      termAliases: aliases,
    });
    if (isUsableCandidate(term, selected, aliases)) {
      return {
        source: "ydr",
        example: selected,
      };
    }
  }

  for (const query of ydrQueries) {
    const selected = await fetchYdrExample(query, {
      term,
      minWords: 3,
      relaxed: true,
      requiredMatches: 1,
      forceRefresh: FORCE_REFRESH,
      termAliases: aliases,
    });
    if (isUsableCandidate(term, selected, aliases)) {
      return {
        source: "ydr",
        example: selected,
      };
    }
  }

  const phraseQueryTerms = dedupeOrdered(buildTatoebaQueryTerms(term)).slice(0, TATOEBA_QUERY_LIMIT);
  const keywordQueryTerms = dedupeOrdered(buildTatoebaKeywordQueries(term)).slice(0, TATOEBA_KEYWORD_QUERY_LIMIT);

  for (const query of phraseQueryTerms) {
    const selected = await fetchTatoebaExample(term, query, {
      relaxed: false,
      minWords: 4,
      maxWords: 34,
      forceRefresh: FORCE_REFRESH,
      termAliases: aliases,
    });
    if (isUsableCandidate(term, selected, aliases)) {
      return {
        source: "tatoeba",
        example: selected,
      };
    }
  }

  for (const query of phraseQueryTerms) {
    const selected = await fetchTatoebaExample(term, query, {
      relaxed: true,
      minWords: 3,
      maxWords: 34,
      requiredMatches: 1,
      forceRefresh: FORCE_REFRESH,
      termAliases: aliases,
    });
    if (isUsableCandidate(term, selected, aliases)) {
      return {
        source: "tatoeba",
        example: selected,
      };
    }
  }

  for (const query of keywordQueryTerms) {
    const selected = await fetchTatoebaExample(term, query, {
      relaxed: false,
      minWords: 4,
      maxWords: 34,
      matchTerm: query,
      forceRefresh: FORCE_REFRESH,
      termAliases: aliases,
    });
    if (isUsableCandidate(term, selected, aliases)) {
      return {
        source: "tatoeba",
        example: selected,
      };
    }
  }

  for (const query of keywordQueryTerms) {
    const selected = await fetchTatoebaExample(term, query, {
      relaxed: true,
      minWords: 3,
      maxWords: 34,
      requiredMatches: 1,
      matchTerm: query,
      forceRefresh: FORCE_REFRESH,
      termAliases: aliases,
    });
    if (isUsableCandidate(term, selected, aliases)) {
      return {
        source: "tatoeba",
        example: selected,
      };
    }
  }

  const manualFallback = MANUAL_EXAMPLE_FALLBACKS[normalize(term)];
  if (manualFallback) {
    return {
      source: "fallback",
      example: manualFallback,
    };
  }

  const fallbackQueries = dedupeOrdered([
    ...buildTatoebaQueryTerms(term),
    ...buildTatoebaKeywordQueries(term),
    ...buildDictionaryQueryTerms(term),
    ...buildTatoebaFallbackQueries(term),
  ]).slice(0, TATOEBA_FALLBACK_QUERY_LIMIT);

  for (const query of fallbackQueries) {
    const selected = await fetchTatoebaExample(term, query, {
      relaxed: true,
      minWords: 5,
      maxWords: 34,
      requiredMatches: 1,
      matchTerm: query,
      forceRefresh: FORCE_REFRESH,
      termAliases: aliases,
    });
    if (selected) {
      return {
        source: "tatoeba",
        example: selected,
      };
    }
  }

  const fallbackOxfordQueries = buildFallbackOxfordQueriesForTerm(term, 14);
  for (const query of fallbackOxfordQueries) {
    const selected = await fetchOxfordExample(term, query, {
      forceRefresh: FORCE_REFRESH,
      minWords: 2,
      relaxed: true,
      allowTemplates: true,
      termAliases: aliases,
    });
    if (isUsableCandidate(term, selected, aliases)) {
      return {
        source: "fallback",
        example: selected,
      };
    }
  }

  return null;
}

async function fetchDictionaryExample(term, options = {}) {
  const query = normalize(term);
  const cacheKey = `dictionary:${query}`;
  if (Object.prototype.hasOwnProperty.call(cache, cacheKey)) {
    if (!options.forceRefresh || cache[cacheKey] !== null) {
      return cache[cacheKey]?.example || null;
    }
    delete cache[cacheKey];
  }

  try {
    const response = await fetchJsonWithRetry(`${DICTIONARY_ENDPOINT}${encodeURIComponent(query)}`, {
      label: `dictionary:${query}`,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    if (!response.ok) {
      cache[cacheKey] = null;
      return null;
    }

    const payload = await response.json();
    const candidates = extractExamplesFromDictionaryPayload(payload);
      const selected = pickBestCandidate(term, candidates, {
        requiredMatches: options.requiredMatches,
        relaxed: options.relaxed,
        termAliases: options.termAliases,
      });
    cache[cacheKey] = selected ? { example: selected, source: "dictionary" } : null;
    return cache[cacheKey]?.example || null;
  } catch (error) {
    cache[cacheKey] = null;
    return null;
  }
}

async function fetchOxfordExample(term, query, options = {}) {
  const queryKey = normalize(query);
  let candidates = oxfordCache[queryKey];
  const shouldRefresh = options.forceRefresh && queryKey in oxfordCache;

  if (shouldRefresh) {
    delete oxfordCache[queryKey];
    candidates = undefined;
  }

  if (!candidates) {
    if (OXFORD_QUERY_DELAY_MS > 0) {
      await delay(OXFORD_QUERY_DELAY_MS);
    }
    try {
      candidates = await fetchOxfordCandidates(query, (url, fetchOptions) =>
        fetch(url, {
          headers: (fetchOptions?.headers || {}),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }),
      );
      oxfordCache[queryKey] = candidates;
      await persistJson(oxfordCachePath, oxfordCache);
    } catch (error) {
      return null;
    }
  }

  try {
    return pickBestOxfordCandidate(term, candidates, options) || null;
  } catch (error) {
    return null;
  }
}

async function fetchPearsonExample(query, options = {}) {
  const target = options.term || query;
  const queryKey = normalize(query);
  let candidates = pearsonCache[queryKey];
  const shouldRefresh = options.forceRefresh && queryKey in pearsonCache;

  if (shouldRefresh) {
    delete pearsonCache[queryKey];
    candidates = undefined;
  }

  if (!candidates) {
    if (PEARSON_QUERY_DELAY_MS > 0) {
      await delay(PEARSON_QUERY_DELAY_MS);
    }
    try {
      candidates = await fetchPearsonCandidates(query, (url) =>
        fetchWithTimeout(url, REQUEST_TIMEOUT_MS, `pearson:${queryKey}`),
      );
      pearsonCache[queryKey] = candidates;
      await persistJson(pearsonCachePath, pearsonCache);
    } catch (error) {
      return null;
    }
  }

  try {
    return (
      pickBestCandidate(target, candidates, {
        ...(typeof options.minWords === "number" ? { minWords: options.minWords } : {}),
        ...(typeof options.maxWords === "number" ? { maxWords: options.maxWords } : {}),
        requiredMatches: options.requiredMatches,
        relaxed: options.relaxed,
        allowTemplates: options.allowTemplates,
      }) || null
    );
  } catch (error) {
    return null;
  }
}

async function fetchCambridgeExample(query, options = {}) {
  const target = options.term || query;
  const queryKey = normalize(query);
  let candidates = cambridgeCache[queryKey];
  const shouldRefresh = options.forceRefresh && queryKey in cambridgeCache;

  if (shouldRefresh) {
    delete cambridgeCache[queryKey];
    candidates = undefined;
  }

  if (!candidates) {
    if (CAMBRIDGE_QUERY_DELAY_MS > 0) {
      await delay(CAMBRIDGE_QUERY_DELAY_MS);
    }
    try {
      candidates = await fetchCambridgeCandidates(query, (url) =>
        fetchWithTimeout(url, REQUEST_TIMEOUT_MS, `cambridge:${queryKey}`),
      );
      cambridgeCache[queryKey] = candidates;
      await persistJson(cambridgeCachePath, cambridgeCache);
    } catch (error) {
      return null;
    }
  }

  try {
    return (
      pickBestCandidate(target, candidates, {
        ...(typeof options.minWords === "number" ? { minWords: options.minWords } : {}),
        ...(typeof options.maxWords === "number" ? { maxWords: options.maxWords } : {}),
        requiredMatches: options.requiredMatches,
        relaxed: options.relaxed,
        allowTemplates: options.allowTemplates,
      }) || null
    );
  } catch (error) {
    return null;
  }
}

async function fetchYdrExample(query, options = {}) {
  const target = options.term || query;
  const queryKey = normalize(query);
  let candidates = ydrCache[queryKey];
  const shouldRefresh = options.forceRefresh && queryKey in ydrCache;

  if (shouldRefresh) {
    delete ydrCache[queryKey];
    candidates = undefined;
  }

  if (!candidates) {
    if (YDR_QUERY_DELAY_MS > 0) {
      await delay(YDR_QUERY_DELAY_MS);
    }
    try {
      candidates = await fetchYDRSentenceCandidates(query, (url) =>
        fetchWithTimeout(url, REQUEST_TIMEOUT_MS, `ydr:${queryKey}`),
      );
      ydrCache[queryKey] = candidates;
      await persistJson(ydrCachePath, ydrCache);
    } catch (error) {
      return null;
    }
  }

  try {
    return (
      pickBestCandidate(target, candidates, {
        ...(typeof options.minWords === "number" ? { minWords: options.minWords } : {}),
        ...(typeof options.maxWords === "number" ? { maxWords: options.maxWords } : {}),
        requiredMatches: options.requiredMatches,
        relaxed: options.relaxed,
        allowTemplates: options.allowTemplates,
      }) || null
    );
  } catch (error) {
    return null;
  }
}

async function fetchFreeDictionaryExample(query, options = {}) {
  const target = options.term || query;
  const queryKey = normalize(query);
  let candidates = freeDictionaryCache[queryKey];
  const shouldRefresh = options.forceRefresh && queryKey in freeDictionaryCache;

  if (shouldRefresh) {
    delete freeDictionaryCache[queryKey];
    candidates = undefined;
  }

  if (!candidates) {
    if (FREEDICTIONARY_QUERY_DELAY_MS > 0) {
      await delay(FREEDICTIONARY_QUERY_DELAY_MS);
    }
    try {
      candidates = await fetchFreeDictionaryCandidates(query, (url) =>
        fetchWithTimeout(url, REQUEST_TIMEOUT_MS, `freedictionary:${queryKey}`),
      );
      freeDictionaryCache[queryKey] = candidates;
      await persistJson(freeDictionaryCachePath, freeDictionaryCache);
    } catch (error) {
      return null;
    }
  }

  try {
    return (
      pickBestCandidate(target, candidates, {
        ...(typeof options.minWords === "number" ? { minWords: options.minWords } : {}),
        ...(typeof options.maxWords === "number" ? { maxWords: options.maxWords } : {}),
        requiredMatches: options.requiredMatches,
        relaxed: options.relaxed,
        allowTemplates: options.allowTemplates,
      }) || null
    );
  } catch (error) {
    return null;
  }
}

function extractExamplesFromDictionaryPayload(payload) {
  const entries = Array.isArray(payload) ? payload : [payload];
  const examples = [];

  for (const item of entries) {
    if (!item?.meanings) continue;
    for (const meaning of item.meanings) {
      if (!meaning?.definitions) continue;
      for (const definition of meaning.definitions) {
        const example = sanitizeText(definition.example);
        if (example) examples.push(example);
      }
    }
  }

  return examples;
}

async function fetchTatoebaExample(term, query, options = {}) {
  const matchTerm = options.matchTerm || term;
  const key = normalize(query);
  let candidates = tatoebaCache[key];
  const shouldRefresh = options.forceRefresh && key in tatoebaCache;

  if (shouldRefresh) {
    delete tatoebaCache[key];
    candidates = undefined;
  }

  if (!candidates) {
    if (TATOEBA_QUERY_DELAY_MS > 0) {
      await delay(TATOEBA_QUERY_DELAY_MS);
    }
    try {
      const response = await fetchTatoebaCandidates(
        query,
        (url) => fetchWithTimeout(url, REQUEST_TIMEOUT_MS, `tatoeba:${key}`),
      );
      candidates = response;
      tatoebaCache[key] = candidates;
      await persistJson(tatoebaCachePath, tatoebaCache);
    } catch (error) {
      return null;
    }
  }

  try {
    let selected = chooseTatoebaSentence(matchTerm, candidates, options);
    if (selected) return selected?.text || null;
    selected = chooseTatoebaSentence(matchTerm, candidates, { ...options, relaxed: true, requiredMatches: 1, minWords: 3 });
    return selected?.text || null;
  } catch (error) {
    return null;
  }
}

function pickBestCandidate(term, candidates, options = {}) {
  const requiredMatches = options.requiredMatches || (Math.min(extractSignificantWords(term).length, 2) || 1);
  const relaxed = Boolean(options.relaxed);
  const allowTemplates = Boolean(options.allowTemplates);
  const termAliases = Array.isArray(options.termAliases) ? options.termAliases : [];
  const minWords = Number.isFinite(options.minWords)
    ? options.minWords
    : relaxed
      ? 3
      : 5;
  const maxWords = Number.isFinite(options.maxWords)
    ? options.maxWords
    : relaxed
      ? 55
      : 34;

  const clean = candidates
    .map((example) => ({
      example: sanitizeText(example),
      score: scoreCandidate(normalize(term), example, {
        relaxed,
        minWords,
        maxWords,
      }),
      relevance: isAnyTermRelevant(term, sanitizeText(example), termAliases, { requiredMatches }),
      template: classifyExample({ term, example: sanitizeText(example) }).isTemplate,
    }))
    .filter((item) => item.example && item.relevance && (allowTemplates || !item.template) && item.score >= 0)
    .filter((item) => item.example && wordCount(item.example) >= minWords && wordCount(item.example) <= maxWords)
    .sort((a, b) => b.score - a.score);

  return clean[0]?.example || "";
}

function pickBestOxfordCandidate(term, candidates, options = {}) {
  const relaxed = Boolean(options.relaxed);
  const minWords = options.minWords || (relaxed ? 3 : 5);
  const maxWords = options.maxWords || 45;
  const allowTemplates = Boolean(options.allowTemplates);
  const termAliases = Array.isArray(options.termAliases) ? options.termAliases : [];

  const clean = candidates
    .map((example) => {
      const text = sanitizeText(example);
      return {
        text,
        words: wordCount(text),
        relevant: isAnyTermRelevant(term, text, termAliases, {
          requiredMatches: 1,
        }),
        template: classifyExample({ term, example: text }).isTemplate,
      };
    })
    .filter((item) => item.text && item.relevant)
    .filter((item) => item.words >= minWords && item.words <= maxWords)
    .filter((item) => allowTemplates || !item.template);

  if (!clean.length) return "";

  clean.sort((a, b) => {
    const scoreA = a.words >= 4 && a.words <= 20 ? 8 : 0;
    const scoreB = b.words >= 4 && b.words <= 20 ? 8 : 0;
    return scoreB - scoreA || b.text.length - a.text.length;
  });

  return clean[0]?.text || "";
}

function isAnyTermRelevant(term, example, aliases, options = {}) {
  const candidates = dedupeOrdered([term, ...(aliases || [])].map(normalize));
  return candidates.some((candidate) =>
    isRelevantExample(candidate, example, {
      ...(options.requiredMatches ? { requiredMatches: options.requiredMatches } : {}),
    }),
  );
}

function buildDictionaryQueryTerms(term) {
  const normalized = normalize(term);
  const variants = new Set(expandSlashTermVariants(normalized));

  for (const variant of [...variants]) {
    const noArticle = variant.replace(/^(?:a|an|the)\s+/i, "").trim();
    if (noArticle) variants.add(noArticle);
  }

  for (const variant of [...variants]) {
    for (const part of variant.split("-")) {
      const value = part.trim();
      if (value) variants.add(value);
    }
  }

  for (const variant of [...variants]) {
    const significantWords = extractSignificantWords(variant);
    if (significantWords.length) {
      significantWords.forEach((word) => variants.add(word));
      if (significantWords.length > 1) {
        variants.add(`${significantWords[0]} ${significantWords[1]}`);
        if (significantWords.length > 2) {
          variants.add(`${significantWords[1]} ${significantWords[2]}`);
        }
        variants.add(`${significantWords[0]}`);
        variants.add(`${significantWords[significantWords.length - 1]}`);
      }
    }
  }

  const expanded = [];
  for (const value of variants) {
    expanded.push(value);
    expanded.push(...expandSpellingVariants(value));
  }

  const candidates = dedupeOrdered(expanded).filter((value) => value.length >= 3);
  const composed = candidates.filter((value) => value.includes(" "));
  const keywords = candidates.filter((value) => !value.includes(" ")).slice(0, DICTIONARY_KEYWORD_QUERY_LIMIT);
  const combined = [...composed, ...keywords];
  return dedupeOrdered(combined).slice(0, DICTIONARY_QUERY_LIMIT);
}

function buildTatoebaFallbackQueries(term) {
  const words = dedupeOrdered(
    expandSlashTermVariants(normalize(term)).flatMap((variant) => extractSignificantWords(variant)),
  ).slice(0, 12);
  const queries = [];

  for (const word of words) {
    queries.push(word);
  }

  for (let start = 0; start < words.length - 1; start += 1) {
    queries.push(`${words[start]} ${words[start + 1]}`);
    if (start + 2 < words.length) {
      queries.push(`${words[start]} ${words[start + 1]} ${words[start + 2]}`);
    }
  }

  if (words.length >= 2) {
    queries.push(`${words[0]} ${words[1]}`);
    queries.push(`${words[words.length - 2]} ${words[words.length - 1]}`);
  }

  return dedupeOrdered(
    queries.flatMap((query) => expandSpellingVariants(query)).filter((query) => query.length >= 3),
  );
}

function expandSpellingVariants(value) {
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return [];

  const variants = new Set([normalized]);

  const britishize = normalized
    .replace(/(?<!\w)center(?!\w)/g, "centre")
    .replace(/(?<!\w)organization(?!\w)/g, "organisation")
    .replace(/(?<!\w)color(?!\w)/g, "colour")
    .replace(/(?<!\w)metre(?!\w)/g, "meter")
    .replace(/-barreled/g, "-barrelled");
  const americanize = normalized
    .replace(/(?<!\w)centre(?!\w)/g, "center")
    .replace(/(?<!\w)organisation(?!\w)/g, "organization")
    .replace(/(?<!\w)colour(?!\w)/g, "color")
    .replace(/(?<!\w)meter(?!\w)/g, "metre")
    .replace(/-barrelled/g, "-barreled");

  variants.add(britishize);
  variants.add(americanize);
  variants.add(normalized.replace(/-/g, " "));

  return [...variants];
}

function expandSlashTermVariants(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return [];

  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (!tokens.some((token) => token.includes("/"))) {
    return [normalized];
  }

  let variants = [[]];
  for (const token of tokens) {
    const options = token.includes("/")
      ? token
          .split("/")
          .map((option) => option.trim())
          .filter(Boolean)
      : [token];

    variants = variants.flatMap((variant) => options.map((option) => [...variant, option]));
  }

  return variants.map((variant) => variant.join(" ").replace(/\s+/g, " ").trim());
}

function buildOxfordQueryTerms(term) {
  const normalized = normalize(term);
  const variants = new Set(expandSlashTermVariants(normalized));

  for (const variant of [...variants]) {
    const noArticle = variant.replace(/^(?:a|an|the)\s+/i, "").trim();
    if (noArticle) variants.add(noArticle);

    const noParen = variant.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
    if (noParen && noParen !== variant) variants.add(noParen);

    for (const part of variant.split("-")) {
      const value = part.trim();
      if (value) variants.add(value);
    }
  }

  for (const variant of [...variants]) {
    const significantWords = extractSignificantWords(variant);
    if (significantWords.length) {
      significantWords.forEach((word) => variants.add(word));
      if (significantWords.length > 1) {
        variants.add(significantWords.slice(0, 2).join("-"));
      }
      if (significantWords.length > 2) {
        variants.add(significantWords.slice(0, 3).join("-"));
      }
      if (significantWords.length > 1) {
        variants.add(`${significantWords[0]}-${significantWords[1]}`);
      }
    }
  }

  const candidateList = [];
  for (const value of variants) {
    candidateList.push(value);
    candidateList.push(value.replace(/\s+/g, "-"));
  }

  return dedupeOrdered(candidateList).filter((value) => value.length >= 3).slice(0, 12);
}

function buildTatoebaQueryTerms(term) {
  const normalized = normalize(term);
  const variants = new Set(expandSlashTermVariants(normalized));

  for (const variant of [...variants]) {
    const noArticle = variant.replace(/^(?:a|an|the)\s+/i, "").trim();
    if (noArticle) variants.add(noArticle);

    const noParen = variant.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
    if (noParen && noParen !== variant) variants.add(noParen);

    const noPoss = variant.replace(/'s/g, "").replace(/\b(\w+)\s+s\b/g, "$1");
    if (noPoss && noPoss !== variant) variants.add(noPoss);

    for (const part of variant.split("-")) {
      const value = part.trim();
      if (value) variants.add(value);
    }
  }

  for (const variant of [...variants]) {
    const words = extractSignificantWords(variant);
    if (words.length >= 1) {
      variants.add(words.join(" "));
      if (words.length >= 2) {
        variants.add(`${words[0]} ${words[1]}`);
        variants.add(`${words[words.length - 2]} ${words[words.length - 1]}`);
        if (words.length >= 3) {
          variants.add(`${words[0]} ${words[2]}`);
          variants.add(`${words[words.length - 3]} ${words[words.length - 1]}`);
          variants.add(`${words[0]} ${words[1]} ${words[2]}`);
          variants.add(`${words[words.length - 3]} ${words[words.length - 2]} ${words[words.length - 1]}`);
        }
      }
    }
  }

  return dedupeOrdered([...variants].filter((value) => value.length >= 3)).slice(0, TATOEBA_QUERY_LIMIT);
}

function buildTatoebaKeywordQueries(term) {
  const words = dedupeOrdered(
    expandSlashTermVariants(normalize(term)).flatMap((variant) => extractSignificantWords(variant)),
  );
  if (words.length <= 1) return [];

  const queries = [];
  const topWords = words.slice(0, 8);
  const bottomWords = words.slice(-8);

  for (const word of topWords) {
    queries.push(word);
  }
  for (const word of bottomWords) {
    if (!queries.includes(word)) queries.push(word);
  }

  for (let start = 0; start < words.length - 1; start += 1) {
    queries.push(`${words[start]} ${words[start + 1]}`);
    if (queries.length > 20) break;
  }

  for (let start = 0; start < words.length - 2; start += 1) {
    if (start + 2 >= words.length) break;
    queries.push(`${words[start]} ${words[start + 1]} ${words[start + 2]}`);
    if (queries.length > 20) break;
  }

  return dedupeOrdered(queries).filter((value) => value.length >= 3).slice(0, TATOEBA_KEYWORD_QUERY_LIMIT);
}

function getAliasTerms(term) {
  const fromMap = TERM_ALIAS_MAP[term] || TERM_ALIAS_MAP[normalize(term)] || [];
  return fromMap.filter((alias) => normalize(alias));
}

function buildDictionaryQueriesForTerm(term, queryLimit = DICTIONARY_QUERY_LIMIT) {
  const terms = [term, ...getAliasTerms(term)];
  const merged = dedupeOrdered(terms.flatMap((value) => buildDictionaryQueryTerms(value)));
  return merged.slice(0, queryLimit);
}

function buildOxfordQueriesForTerm(term, queryLimit = 10) {
  const terms = [term, ...getAliasTerms(term)];
  const merged = dedupeOrdered(
    terms.flatMap((value) => [...buildOxfordQueryTerms(value), ...buildDictionaryQueryTerms(value)]),
  );
  return merged.slice(0, queryLimit);
}

function buildPearsonQueriesForTerm(term, queryLimit = 10) {
  const terms = [term, ...getAliasTerms(term)];
  const merged = dedupeOrdered(terms.flatMap((value) => [...buildOxfordQueryTerms(value), ...buildDictionaryQueryTerms(value)]));
  return merged.slice(0, queryLimit);
}

function buildCambridgeQueriesForTerm(term, queryLimit = 12) {
  const terms = [term, ...getAliasTerms(term)];
  const merged = dedupeOrdered(
    terms.flatMap((value) => [...buildOxfordQueryTerms(value), ...buildDictionaryQueryTerms(value), ...buildTatoebaFallbackQueries(value)]),
  );
  return merged.slice(0, queryLimit);
}

function buildYdrQueriesForTerm(term, queryLimit = 12) {
  const terms = [term, ...getAliasTerms(term)];
  const merged = dedupeOrdered(
    terms.flatMap((value) => [...buildOxfordQueryTerms(value), ...buildDictionaryQueryTerms(value), ...buildTatoebaFallbackQueries(value)]),
  );
  return merged.slice(0, queryLimit);
}

function buildFallbackOxfordQueriesForTerm(term, queryLimit = 14) {
  const terms = [term, ...getAliasTerms(term)];
  const merged = dedupeOrdered(terms.flatMap((value) => [...buildOxfordQueryTerms(value), ...buildDictionaryQueryTerms(value)]));
  return merged.slice(0, queryLimit);
}

function buildFreeDictionaryQueriesForTerm(term, queryLimit = DICTIONARY_QUERY_LIMIT) {
  return buildDictionaryQueriesForTerm(term, queryLimit);
}

function isUsableCandidate(term, example, aliases = []) {
  if (!example) return false;

  const normalized = sanitizeText(example);
  if (!normalized) return false;

  const terms = dedupeOrdered([term, ...aliases]);
  for (const candidate of terms) {
    const sanitized = sanitizeExamples({
      term: candidate,
      examples: [{ en: normalized, zh: "" }],
    });
    if (sanitized.length > 0) return true;
  }

  return relaxedCandidate(term, normalized, aliases);
}

function sanitizeExamplesWithAliases(term, example, aliases = []) {
  const terms = dedupeOrdered([term, ...aliases]);
  for (const candidate of terms) {
    const sanitized = sanitizeExamples({
      term: candidate,
      examples: [{ en: sanitizeText(example), zh: "" }],
    });
    if (sanitized.length) return sanitized;
  }
  return [];
}

function relaxedCandidate(term, text, aliases = []) {
  const example = sanitizeText(text);
  if (!example) return false;
  if (!/[.!?]$/.test(example)) return false;
  if (wordCount(example) < 4 || wordCount(example) > 45) return false;
  if (classifyExample({ term, example }).isTemplate) return false;
  if (isAnyTermRelevant(term, example, aliases)) return true;
  return false;
}

function dedupeOrdered(values) {
  const seen = new Set();
  const next = [];
  for (const value of values) {
    if (!value) continue;
    const current = sanitizeText(value);
    if (!current || seen.has(current)) continue;
    seen.add(current);
    next.push(current);
  }
  return next;
}

function extractSignificantWords(value) {
  return normalize(value)
    .replace(/[^a-z0-9'\-\s]/g, " ")
    .split(/\s+/)
    .map((part) => part.replace(/['’-]/g, ""))
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !STOP_WORDS.has(part));
}

function scoreCandidate(termLower, example, options = {}) {
  const cleaned = sanitizeText(example);
  if (!cleaned) return 0;
  const tokens = wordCount(cleaned);
  const relaxed = Boolean(options.relaxed);
  const minWords = Number.isFinite(options.minWords) ? options.minWords : relaxed ? 3 : 5;
  const maxWords = Number.isFinite(options.maxWords) ? options.maxWords : relaxed ? 50 : 28;

  if (tokens < minWords || tokens > maxWords) return 0;
  if (!isNotTemplate(cleaned)) return 0;
  const lower = cleaned.toLowerCase();
  let score = 0;
  if (lower.includes(termLower)) score += 30;
  if (/[.!?]$/.test(cleaned)) score += 8;
  if (tokens > 8 && tokens < 20) score += 6;
  if (cleaned.includes(",")) score += 2;
  return score;
}

function isNotTemplate(example) {
  return (
    !/^\s*(she|he)\s+(was|is)\s+(a|an)\s+[a-z-]+\.\s*$/i.test(example) &&
    !/^(a|an|the)\s+[a-z-]+(?:\s+[a-z-]+){0,2}\s*$/i.test(example) &&
    wordCount(example) >= 5
  );
}

function sanitizeText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalize(value) {
  return String(value).replace(/\s+/g, " ").trim().toLowerCase();
}

async function fetchJsonWithRetry(url, options) {
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    const label = `${options.label} [attempt ${attempt + 1}/${RETRY_ATTEMPTS}]`;
    try {
      return await fetchWithTimeout(url, options.timeoutMs, label);
    } catch (error) {
      if (attempt === RETRY_ATTEMPTS - 1) throw error;
      await delay(200 * (attempt + 1));
    }
  }
  throw new Error(`unreachable ${options.label}`);
}

async function fetchWithTimeout(resource, timeoutMs, label = "fetch") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(resource, { signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapLimit(values, limit, mapper) {
  let index = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (index < values.length) {
      const current = values[index];
      index += 1;
      try {
        await mapper(current);
      } catch (error) {
        console.error(`failed resolving term ${current}:`, error.message || error);
      }
    }
  });
  await Promise.all(workers);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function persistJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}
