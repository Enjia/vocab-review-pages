import fs from "node:fs/promises";
import path from "node:path";
import { chooseTatoebaSentence, fetchTatoebaCandidates } from "./tatoeba-source.mjs";

const inputPath = process.argv[2] || "audit-template-examples.json";
const outputPath = process.argv[3] || "tatoeba-replacements.json";
const cachePath = process.argv[4] || "tatoeba-cache.json";

const audit = JSON.parse(await fs.readFile(inputPath, "utf8"));
const cache = await readJson(cachePath, {});
const uniqueTerms = [...new Set(audit.entries.map((entry) => entry.term.toLowerCase()))];
const replacements = [];
const misses = [];

await mapLimit(uniqueTerms, 4, async (cacheKey) => {
  if (cache[cacheKey]) return;
  const entry = audit.entries.find((item) => item.term.toLowerCase() === cacheKey);
  cache[cacheKey] = await fetchTatoebaCandidates(entry.term);
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
  await delay(250);
});

for (const entry of audit.entries) {
  const cacheKey = entry.term.toLowerCase();
  const selected = chooseTatoebaSentence(entry.term, cache[cacheKey]);
  if (selected) {
    replacements.push({
      id: entry.id,
      term: entry.term,
      relativePath: entry.relativePath,
      oldEn: entry.oldEn,
      oldZh: entry.oldZh,
      newEn: selected.text,
      newZh: "",
      source: {
        name: "Tatoeba",
        sentenceId: selected.id,
        author: selected.user?.username || "",
        license: selected.license || "",
        url: `https://tatoeba.org/en/sentences/show/${selected.id}`,
      },
    });
  } else {
    misses.push({
      id: entry.id,
      term: entry.term,
      relativePath: entry.relativePath,
      oldEn: entry.oldEn,
      reason: entry.reason,
    });
  }
}

await fs.writeFile(
  outputPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceAudit: path.basename(inputPath),
      count: replacements.length,
      missCount: misses.length,
      replacements,
      misses,
    },
    null,
    2,
  ),
);

console.log(
  JSON.stringify(
    {
      replacements: replacements.length,
      misses: misses.length,
      outputPath,
      cachePath,
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapLimit(values, limit, mapper) {
  let index = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (index < values.length) {
      const current = values[index];
      index += 1;
      await mapper(current);
    }
  });
  await Promise.all(workers);
}
