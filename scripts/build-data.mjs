import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseVocabularyFile } from "./parser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultVaultRoot =
  "/Users/chenenjia/Library/Mobile Documents/iCloud~md~obsidian/Documents/My Second Brain";
const defaultSourceDir = path.join(defaultVaultRoot, "Project/背单词");

const sourceDir = process.env.VOCAB_SOURCE_DIR || defaultSourceDir;
const vaultRoot = process.env.VOCAB_VAULT_ROOT || defaultVaultRoot;
const outputPath = path.join(projectRoot, "data/words.json");

const files = await collectMarkdownFiles(sourceDir);
const entries = [];

for (const filePath of files) {
  const markdown = await fs.readFile(filePath, "utf8");
  entries.push(...parseVocabularyFile({ filePath, vaultRoot, markdown }));
}

entries.sort((a, b) => a.term.localeCompare(b.term, "en"));
dedupeEntryIds(entries);

const payload = {
  generatedAt: new Date().toISOString(),
  sourceDir,
  count: entries.length,
  entries,
  facets: buildFacets(entries),
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
console.log(`Generated ${entries.length} vocabulary entries -> ${outputPath}`);

async function collectMarkdownFiles(root) {
  const results = [];
  const stack = [root];

  while (stack.length) {
    const current = stack.pop();
    const dirents = await fs.readdir(current, { withFileTypes: true });
    for (const dirent of dirents) {
      const fullPath = path.join(current, dirent.name);
      if (dirent.isDirectory()) {
        if (dirent.name === "Hub" || dirent.name === "images") continue;
        stack.push(fullPath);
      } else if (dirent.isFile() && dirent.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  }

  return results.sort();
}

function buildFacets(entries) {
  return {
    expressionTypes: counts(entries.map((entry) => entry.expressionType)),
    partsOfSpeech: counts(entries.map((entry) => entry.partOfSpeech)),
    themes: counts(entries.map((entry) => entry.theme)),
    tags: counts(entries.flatMap((entry) => entry.tags)),
  };
}

function dedupeEntryIds(entries) {
  const seen = new Map();
  for (const entry of entries) {
    const count = (seen.get(entry.id) || 0) + 1;
    seen.set(entry.id, count);
    if (count > 1) {
      entry.id = `${entry.id}--${count}`;
    }
  }
}

function counts(values) {
  const map = new Map();
  for (const value of values.filter(Boolean)) {
    map.set(value, (map.get(value) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"))
    .map(([name, count]) => ({ name, count }));
}
