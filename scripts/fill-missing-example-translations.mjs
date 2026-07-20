import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cleanMachineTranslation, extractMyMemoryText } from "./example-translation-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wordsPath = path.join(projectRoot, "data", "words.json");
const cachePath = path.join(projectRoot, "data", "example-translation-cache.json");
const reportPath = path.join(projectRoot, "data", "example-translation-report.json");

const CONCURRENCY = Number(process.env.VOCAB_TRANSLATION_CONCURRENCY || 6);
const FORCE_REFRESH = process.env.VOCAB_FORCE_REFRESH_TRANSLATIONS === "1";
const CACHE_FLUSH_INTERVAL = Number(process.env.VOCAB_TRANSLATION_FLUSH_INTERVAL || 20);
const execFileAsync = promisify(execFile);

const payload = JSON.parse(await fs.readFile(wordsPath, "utf8"));
const entries = payload.entries || [];
const cache = await readJson(cachePath, {});

const missingZhEntries = entries.filter((entry) => entry.examples?.[0]?.en?.trim() && !entry.examples?.[0]?.zh?.trim());
const uniqueExamples = [...new Set(missingZhEntries.map((entry) => entry.examples[0].en.trim()))];

console.log(`translating ${uniqueExamples.length} unique example sentences, concurrency: ${CONCURRENCY}`);

let processed = 0;
await mapLimit(uniqueExamples, CONCURRENCY, async (sentence) => {
  const key = normalize(sentence);
  if (!FORCE_REFRESH && Object.prototype.hasOwnProperty.call(cache, key)) {
    processed += 1;
    return;
  }

  try {
    cache[key] = await translateSentence(sentence);
  } catch (error) {
    cache[key] = "";
  }
  processed += 1;

  if (processed % CACHE_FLUSH_INTERVAL === 0) {
    await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), "utf8");
  }

  if (processed % 50 === 0 || processed === uniqueExamples.length) {
    console.log(`translation progress: ${processed}/${uniqueExamples.length}`);
  }
});

await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), "utf8");

let updated = 0;
const unresolved = [];

for (const entry of entries) {
  const example = entry.examples?.[0];
  if (!example?.en?.trim() || example.zh?.trim()) continue;

  const translated = cache[normalize(example.en)];
  if (!translated) {
    unresolved.push({
      term: entry.term,
      exampleEn: example.en,
      sourcePath: entry.sourcePath,
    });
    continue;
  }

  example.zh = translated;
  updated += 1;
}

payload.entries = entries;
payload.lastExampleTranslation = new Date().toISOString();
await fs.writeFile(wordsPath, JSON.stringify(payload, null, 2), "utf8");

const report = {
  generatedAt: payload.lastExampleTranslation,
  translatedExamples: uniqueExamples.length,
  updatedEntries: updated,
  unresolved,
};

await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

console.log(
  JSON.stringify(
    {
      translatedExamples: uniqueExamples.length,
      updatedEntries: updated,
      unresolved: unresolved.length,
    },
    null,
    2,
  ),
);

async function translateSentence(sentence) {
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(sentence) +
    "&langpair=en|zh-CN";
  const { stdout } = await execFileAsync(
    "curl",
    [
      "--silent",
      "--show-error",
      "--fail",
      "--ipv4",
      "--max-time",
      "8",
      "-A",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      url,
    ],
    {
      maxBuffer: 1024 * 1024,
    },
  );
  const payload = JSON.parse(stdout);
  return cleanMachineTranslation(extractMyMemoryText(payload));
}

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
