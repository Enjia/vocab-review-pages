import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchYoudaoBilingualCandidates } from "./ydr-source.mjs";
import { pickBestBilingualCandidate } from "./bilingual-example-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wordsPath = path.join(projectRoot, "data", "words.json");
const cachePath = path.join(projectRoot, "data", "bilingual-example-cache.json");
const reportPath = path.join(projectRoot, "data", "bilingual-example-report.json");

const CONCURRENCY = Number(process.env.VOCAB_BILINGUAL_CONCURRENCY || 6);
const FORCE_REFRESH = process.env.VOCAB_FORCE_REFRESH_BILINGUAL === "1";

const payload = JSON.parse(await fs.readFile(wordsPath, "utf8"));
const entries = payload.entries || [];
const cache = await readJson(cachePath, {});

const missingEntries = entries.filter(
  (entry) => !entry.definition?.trim() || !entry.examples?.[0]?.en?.trim() || !entry.examples?.[0]?.zh?.trim(),
);

const termMap = new Map();
for (const entry of missingEntries) {
  const key = normalize(entry.term);
  if (!termMap.has(key)) termMap.set(key, entry.term);
}

const uniqueTerms = [...termMap.keys()];
console.log(`enriching bilingual examples for ${uniqueTerms.length} unique terms, concurrency: ${CONCURRENCY}`);

let processed = 0;
await mapLimit(uniqueTerms, CONCURRENCY, async (key) => {
  if (!FORCE_REFRESH && Object.prototype.hasOwnProperty.call(cache, key)) {
    processed += 1;
    return;
  }

  const term = termMap.get(key);
  const candidates = await fetchYoudaoBilingualCandidates(term);
  cache[key] = candidates;
  processed += 1;

  if (processed % 50 === 0 || processed === uniqueTerms.length) {
    console.log(`bilingual fetch progress: ${processed}/${uniqueTerms.length}`);
  }
});

await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), "utf8");

const report = {
  generatedAt: new Date().toISOString(),
  totalEntries: entries.length,
  beforeMissingAny: missingEntries.length,
  updated: 0,
  unresolved: [],
};

for (const entry of entries) {
  const missingDefinition = !entry.definition?.trim();
  const current = entry.examples?.[0] || { en: "", zh: "" };
  const missingExampleEn = !current.en?.trim();
  const missingExampleZh = !current.zh?.trim();

  if (!missingDefinition && !missingExampleEn && !missingExampleZh) continue;

  const candidates = cache[normalize(entry.term)] || [];
  const selected = pickBestBilingualCandidate({
    term: entry.term,
    currentExampleEn: current.en || "",
    candidates,
  });

  if (selected) {
    entry.examples = [selected];
    report.updated += 1;
    continue;
  }

  report.unresolved.push({
    term: entry.term,
    sourcePath: entry.sourcePath,
    missingDefinition,
    missingExampleEn,
    missingExampleZh,
  });
}

payload.entries = entries;
payload.lastBilingualExampleEnrichment = report.generatedAt;
await fs.writeFile(wordsPath, JSON.stringify(payload, null, 2), "utf8");
await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

console.log(
  JSON.stringify(
    {
      beforeMissingAny: report.beforeMissingAny,
      updated: report.updated,
      unresolved: report.unresolved.length,
    },
    null,
    2,
  ),
);

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function mapLimit(items, limit, iteratee) {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (typeof next === "undefined") return;
      await iteratee(next);
    }
  });

  await Promise.all(workers);
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}
