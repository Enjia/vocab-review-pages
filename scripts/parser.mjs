import path from "node:path";

const TYPE_PREFIXES = [
  "固定搭配_习语",
  "句式模板",
  "短语",
  "单词",
];

const POS_SUFFIXES = ["形容词", "副词", "名词", "动词"];

export function parsePathMeta(filePath) {
  const normalized = filePath.split(path.sep).join("/");
  const parts = normalized.split("/");
  const fileName = parts.at(-1) || "";
  const parent = parts.at(-2) || "";
  const theme = fileName.replace(/\.md$/i, "").replace(/_/g, "/");

  let expressionType = parent;
  let partOfSpeech = "";

  for (const prefix of TYPE_PREFIXES) {
    if (parent.startsWith(prefix)) {
      expressionType = prefix;
      partOfSpeech = parent.slice(prefix.length).replace(/^_/, "");
      break;
    }
  }

  for (const suffix of POS_SUFFIXES) {
    if (parent.endsWith(suffix) && !partOfSpeech) {
      partOfSpeech = suffix;
      expressionType = parent.slice(0, -suffix.length) || parent;
      break;
    }
  }

  return {
    expressionType,
    partOfSpeech,
    theme,
  };
}

export function parseVocabularyFile({ filePath, vaultRoot, markdown }) {
  const meta = parsePathMeta(filePath);
  const relativePath = path.relative(vaultRoot, filePath).split(path.sep).join("/");
  const blocks = splitEntryBlocks(markdown);

  return blocks.map((block) => parseEntryBlock(block, meta, relativePath)).filter(Boolean);
}

function splitEntryBlocks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^####\s+(?:\d+\.)?(.+?)\s*$/);
    if (heading) {
      if (current) blocks.push(current);
      current = {
        rawTerm: heading[1],
        term: cleanTerm(heading[1]),
        lines: [],
      };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  if (current) blocks.push(current);
  return blocks;
}

function parseEntryBlock(block, meta, relativePath) {
  if (!block.term) return null;

  const body = block.lines.join("\n").trim();
  const legacyInline = extractLegacyInlineData(block.rawTerm);
  const definition = extractDefinition(block.lines) || legacyInline?.definition || "";
  const examples = extractExamples(block.lines);
  const resolvedExamples = examples.length ? examples : legacyInline?.examples || [];
  const relationLine = block.lines.find((line) => line.trim().startsWith("- 关联：")) || "";
  const relationWithoutLinks = relationLine.replace(/\[\[[^\]]+\]\]/g, "");
  const tags = [...relationWithoutLinks.matchAll(/#([\p{Script=Han}\w-]+)/gu)].map(
    (match) => match[1],
  );
  const relatedTerms = [...relationLine.matchAll(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g)].map(
    (match) => cleanTerm(match[1]),
  );

  return {
    id: createId(relativePath, block.term),
    term: block.term,
    definition,
    examples: resolvedExamples,
    relatedTerms: unique(relatedTerms),
    tags: unique(tags),
    expressionType: meta.expressionType,
    partOfSpeech: meta.partOfSpeech,
    theme: meta.theme,
    sourcePath: relativePath,
    body,
  };
}

function extractDefinition(lines) {
  const line = lines.find((item) => item.trim().startsWith("- 释义："));
  return line ? cleanDefinition(line.replace(/^\s*-\s*释义：\s*/, "")) : "";
}

function extractExamples(lines) {
  const examples = [];
  let inExamples = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- 例句：")) {
      inExamples = true;
      continue;
    }
    if (inExamples && /^-\s+\S/.test(line)) {
      break;
    }
    if (inExamples) {
      const match = line.match(/^\s*-\s+(.+?)\s*$/);
      if (match) {
        examples.push(splitBilingualExample(match[1]));
      }
    }
  }

  return examples;
}

function splitBilingualExample(text) {
  const index = text.indexOf("：");
  if (index === -1) {
    return { en: text.trim(), zh: "" };
  }
  return {
    en: text.slice(0, index).trim(),
    zh: text.slice(index + 1).trim(),
  };
}

function cleanTerm(term) {
  let value = normalizeTermBase(term);
  const inline = splitLegacyInlineHeading(value);
  if (inline) value = inline.term;
  value = extractQuotedDictionaryTerm(value) || value;
  return normalizeTermBase(value);
}

function normalizeTermBase(term) {
  return String(term)
    .replace(/^#/, "")
    .replace(/^\d+\./, "")
    .replace(/^\.+/, "")
    .replace(/^[ˌˈ]+/, "")
    .trim();
}

function extractLegacyInlineData(term) {
  const inline = splitLegacyInlineHeading(normalizeTermBase(term));
  if (!inline) return null;

  const example = extractParentheticalExample(inline.tail);
  return {
    definition: cleanDefinition(example ? inline.tail.slice(0, example.start) : inline.tail),
    examples: example ? [splitBilingualExample(example.text)] : [],
  };
}

function splitLegacyInlineHeading(value) {
  const splitIndex = findLegacyInlineSplit(value);
  if (splitIndex === -1) return null;

  return {
    term: normalizeTermBase(value.slice(0, splitIndex)),
    tail: value.slice(splitIndex + 1).trim(),
  };
}

function findLegacyInlineSplit(value) {
  const candidates = [];
  const fullWidthIndex = value.indexOf("：");
  if (fullWidthIndex > 0) candidates.push(fullWidthIndex);

  const asciiIndex = value.indexOf(":");
  if (asciiIndex > 0) {
    const after = value.slice(asciiIndex + 1).trim();
    if (/^[（(]|^\p{Script=Han}/u.test(after)) candidates.push(asciiIndex);
  }

  return candidates.length ? Math.min(...candidates) : -1;
}

function extractParentheticalExample(text) {
  const start = text.lastIndexOf("（");
  const end = text.lastIndexOf("）");
  if (start === -1) return null;

  const candidate = text.slice(start + 1, end > start ? end : undefined).trim();
  if (!/[A-Za-z]/.test(candidate)) return null;

  return { start, text: candidate };
}

function extractQuotedDictionaryTerm(value) {
  if (!/^['"“]/.test(value)) return "";

  const embeddedPhrase = value.match(/\brant and rave\b/i);
  if (embeddedPhrase) return embeddedPhrase[0].toLowerCase();

  const finalQuotedPhrase = value.match(/'([^']+)'$/);
  if (finalQuotedPhrase && wordCount(finalQuotedPhrase[1]) <= 4) {
    return stripTrailingPunctuation(finalQuotedPhrase[1]).toLowerCase();
  }

  const reportingVerbMatch = value.match(
    /^['"“].*['"”],?\s+(?:he|she|they|it)\s+(?:said|began|asked|replied|answered|whispered|muttered|shouted|cried|remarked)\s*,?\s*(?:finally\s+)?([A-Za-z][A-Za-z -]*?)\.?$/i,
  );
  if (reportingVerbMatch) return reportingVerbMatch[1].trim();

  const trailingSpeechMatch = value.match(
    /^['"“].*['"”],?\s+(?:he|she|they|it)\s+([A-Za-z][A-Za-z -]*?)\.?$/i,
  );
  return trailingSpeechMatch ? trailingSpeechMatch[1].trim() : "";
}

function cleanDefinition(value) {
  const definition = String(value).trim();
  if (!definition.includes("（")) return definition.replace(/）$/, "");
  return definition;
}

function stripTrailingPunctuation(value) {
  return value.trim().replace(/[.!?。！？]+$/, "");
}

function wordCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function createId(relativePath, term) {
  return `${relativePath}#${term}`.toLowerCase().replace(/\s+/g, "-");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
