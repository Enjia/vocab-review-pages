const SHORT_EXAMPLE_LIMIT = 7;

export function classifyExample({ term, example }) {
  const normalizedTerm = normalize(term);
  const normalizedExample = normalize(example);
  const count = wordCount(example);
  const isShort = count > 0 && count <= SHORT_EXAMPLE_LIMIT;
  const isMultiWordTerm = /\s/.test(normalizedTerm);

  const checks = [
    {
      reason: "bare-it-was-term",
      pattern: isMultiWordTerm
        ? new RegExp(`^it\\s+(was|is)\\s+${escapeRegExp(normalizedTerm)}\\.$`, "i")
        : /a^/,
    },
    {
      reason: "mechanical-adverb-response",
      pattern: /^[a-z-]+ly,\s+(she|he|they)\s+responded\.$/i,
    },
    {
      reason: "bare-it-was",
      pattern: /^it\s+(was|is)\s+(very\s+|quite\s+|really\s+)?[a-z-]+\.$/i,
    },
    {
      reason: "bare-subject-was",
      pattern: /^(the|a|an)\s+[a-z-]+\s+(was|is|were|are)\s+(very\s+|quite\s+|really\s+)?[a-z-]+\.$/i,
    },
    {
      reason: "generic-person-label",
      pattern: /^(she|he)\s+(was|is)\s+(a|an)\s+[a-z-]+\.$/i,
    },
    {
      reason: "embedded-numbering",
      pattern: /\b\d+\.\s+[a-z]/i,
    },
    {
      reason: "definitional-stub",
      pattern: /^(?:used to say that|of or relating to)\b/i,
    },
    {
      reason: "gloss-fragment",
      pattern:
        count <= 6 && !/[.!?]$/.test(normalizedExample) && !hasSentenceVerb(normalizedExample)
          ? /.+/
          : /a^/,
    },
    {
      reason: "noun-phrase-fragment",
      pattern: /^(?:a|an|the)\s+[a-z-]+(?:\/[a-z-]+)?(?:\s+[a-z-]+(?:\/[a-z-]+)?){0,2}$/i,
    },
  ];

  const match = checks.find((check) => check.pattern.test(normalizedExample));

  return {
    isShort,
    isTemplate: Boolean(
      match &&
        (normalizedExample.includes(normalizedTerm) ||
          match.reason === "definitional-stub" ||
          match.reason === "gloss-fragment" ||
          match.reason === "noun-phrase-fragment") &&
        (isShort ||
          match.reason === "embedded-numbering" ||
          match.reason === "definitional-stub" ||
          match.reason === "gloss-fragment" ||
          match.reason === "noun-phrase-fragment"),
    ),
    reason: match?.reason || "",
    wordCount: count,
  };
}

export function sanitizeExamples({ term, examples }) {
  return examples.filter((example) => {
    const result = classifyExample({ term, example: example.en || "" });
    return !result.isTemplate && isRelevantExample(term, example.en || "");
  });
}

export function normalizeEntryExamples(entry) {
  const extracted = extractEmbeddedExampleFromDefinition(entry.term, entry.definition);
  const examples = sanitizeExamples({ term: entry.term, examples: entry.examples || [] });
  const nextExamples = [...examples];

  const extractedExamples = extracted.example
    ? sanitizeExamples({ term: entry.term, examples: [extracted.example] })
    : [];

  if (
    extractedExamples[0] &&
    !nextExamples.some((item) => normalize(item.en) === normalize(extractedExamples[0].en))
  ) {
    nextExamples.push(extractedExamples[0]);
  }

  return {
    ...entry,
    definition: extracted.definition,
    examples: nextExamples,
  };
}

export function backfillExamplesByTerm(entries) {
  const donors = new Map();

  for (const entry of entries) {
    if (!entry.examples?.length) continue;
    const key = normalize(entry.term);
    if (!donors.has(key)) donors.set(key, entry.examples);
  }

  return entries.map((entry) => {
    if (entry.examples?.length) return entry;
    const donor = donors.get(normalize(entry.term));
    if (!donor) return entry;
    return {
      ...entry,
      examples: donor,
    };
  });
}

export function wordCount(value) {
  return (value.match(/[A-Za-z]+(?:[-'][A-Za-z]+)?/g) || []).length;
}

function normalize(value) {
  return String(value).replace(/\s+/g, " ").toLowerCase().trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasSentenceVerb(value) {
  return /\b(?:am|is|are|was|were|be|been|being|have|has|had|do|does|did|can|could|will|would|shall|should|may|might|must|ought|need|dare)\b/i.test(
    value,
  ) || /\b[a-z]+(?:ed|ing)\b/i.test(value);
}

function extractEmbeddedExampleFromDefinition(term, definition) {
  const source = String(definition || "").replace(/\u00a0/g, " ").trim();
  const groups = [
    ...source.matchAll(/[（(]([^()（）]+)[）)]/g),
    ...source.matchAll(/[（(]([^()（）]+)$/g),
  ];

  for (const group of groups) {
    const candidate = splitEmbeddedCandidate(term, group[1]);
    if (!candidate) continue;

    return {
      definition: cleanupDefinition(
        `${source.slice(0, group.index)}${source.slice(group.index + group[0].length)}`,
      ),
      example: candidate,
    };
  }

  return {
    definition: cleanupDefinition(source),
    example: null,
  };
}

function splitEmbeddedCandidate(term, raw) {
  const content = raw.replace(/\u00a0/g, " ").trim();
  if (!/[A-Za-z]/.test(content)) return null;

  let en = content;
  let zh = "";

  if (content.includes("：")) {
    const index = content.lastIndexOf("：");
    en = content.slice(0, index).trim();
    zh = content.slice(index + 1).trim();
  } else {
    const hanIndex = content.search(/\p{Script=Han}/u);
    if (hanIndex !== -1) {
      en = content.slice(0, hanIndex).trim();
      zh = content.slice(hanIndex).trim();
    }
  }

  en = extractBestEnglishSnippet(term, en);
  if (!en) return null;

  const words = wordCount(en);
  if (words < 4 || words > 45) return null;
  if (/[/:]{2,}/.test(en)) return null;
  if (!/[ .?!']/u.test(en)) return null;

  return {
    en: en.replace(/\s+/g, " ").trim(),
    zh,
  };
}

function cleanupDefinition(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*（\s*）\s*/g, " ")
    .replace(/\s*[（(][^()（）]*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBestEnglishSnippet(term, value) {
  const normalizedTerm = normalize(term);
  const candidates = [];
  const source = value.replace(/\u00a0/g, " ").trim();

  candidates.push(source);

  const egMatch = source.match(/\b(?:eg\.|e\.g\.)\s*(.+)$/i);
  if (egMatch) candidates.push(egMatch[1].trim());

  for (const segment of source.split(/[。]+/u)) {
    const trimmed = segment.trim();
    if (trimmed) candidates.push(trimmed);
  }

  for (const segment of source.split(/(?<=[.!?])\s+/u)) {
    const trimmed = segment.trim();
    if (trimmed) candidates.push(trimmed);
  }

  const scored = candidates
    .map((candidate) => candidate.replace(/\s+/g, " ").trim())
    .filter((candidate) => !/\p{Script=Han}/u.test(candidate))
    .map((candidate) => ({ candidate, score: scoreCandidate(normalizedTerm, candidate) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.candidate || "";
}

function scoreCandidate(normalizedTerm, candidate) {
  const words = wordCount(candidate);
  if (words < 4 || words > 45) return 0;

  let score = 0;
  if (normalize(candidate).includes(normalizedTerm)) score += 10;
  if (/^[A-Z"'“]/.test(candidate)) score += 6;
  if (/[.!?]$/.test(candidate)) score += 4;
  if (candidate.includes(",")) score += 2;
  if (/\b(?:eg\.|e\.g\.)\b/i.test(candidate)) score -= 8;
  if (candidate.includes("：")) score -= 6;
  if (candidate.includes("/")) score -= 4;

  return score;
}

function isRelevantExample(term, example) {
  const normalizedExample = normalize(example);
  if (!normalizedExample) return false;

  const compactExample = compact(normalizedExample);
  const exampleTokens = new Set(tokenizeForMatch(normalizedExample));
  const termVariants = buildTermVariants(term);

  for (const variant of termVariants) {
    if (compactExample.includes(variant.compact)) return true;
    const matchedGroups = variant.tokenGroups.filter((group) =>
      group.some((token) => exampleTokens.has(token) || hasTokenMatch(token, normalizedExample)),
    );
    if (matchedGroups.length >= requiredTokenMatches(variant.tokenCount)) return true;
  }

  return false;
}

function buildTermVariants(term) {
  const source = String(term)
    .replace(/[()]/g, " ")
    .replace(/\bsb(?:'s)?\b/gi, " ")
    .replace(/\bsth\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const alternatives = source
    .split(/\s+\/\s+|\/+/)
    .map((part) => normalize(part))
    .filter(Boolean);

  if (!alternatives.length) alternatives.push(normalize(source));

  return alternatives
    .map((variant) => {
      const baseTokens = baseMatchTokens(variant);
      const tokenGroups = baseTokens.map((token) => Array.from(stemVariants(token)));
      return {
        compact: compact(variant),
        tokenGroups,
        tokenCount: baseTokens.length,
      };
    })
    .filter((variant) => variant.compact || variant.tokenGroups.length);
}

function tokenizeForMatch(value) {
  return Array.from(new Set(baseMatchTokens(value).flatMap((token) => Array.from(stemVariants(token)))));
}

function baseMatchTokens(value) {
  return Array.from(
    new Set(
      (normalize(value).match(/[a-z]+(?:['-][a-z]+)*/g) || [])
        .map((token) => token.replace(/^'+|'+$/g, ""))
        .filter((token) => token.length >= 3)
        .filter((token) => !STOP_WORDS.has(token))
    ),
  );
}

function hasTokenMatch(token, normalizedExample) {
  const pattern = new RegExp(`\\b${escapeRegExp(token)}[a-z]*\\b`, "i");
  if (pattern.test(normalizedExample)) return true;
  return tokenizeForMatch(normalizedExample).includes(token);
}

function requiredTokenMatches(tokenCount) {
  if (tokenCount <= 1) return 1;
  return Math.min(2, tokenCount);
}

function stemVariants(token) {
  const variants = new Set([token]);
  const normalized = normalizeSpelling(token);
  variants.add(normalized);

  const compacted = compact(normalized);
  if (compacted) variants.add(compacted);

  for (const value of Array.from(variants)) {
    if ((value.endsWith("ized") || value.endsWith("ised")) && value.length > 6) {
      variants.add(value.slice(0, -4));
    }
    if ((value.endsWith("izing") || value.endsWith("ising")) && value.length > 7) {
      variants.add(value.slice(0, -5));
    }
    if (value.endsWith("e") && value.length > 4) variants.add(value.slice(0, -1));
    if (value.endsWith("ie") && value.length > 4) variants.add(`${value.slice(0, -2)}y`);
    if (value.endsWith("ance") || value.endsWith("ence")) variants.add(value.slice(0, -3));
    if (value.endsWith("ate") || value.endsWith("ise") || value.endsWith("ize")) {
      variants.add(value.slice(0, -1));
    }
    if (value.endsWith("ing") && value.length > 5) variants.add(value.slice(0, -3));
    if (value.endsWith("ed") && value.length > 4) variants.add(value.slice(0, -2));
    if (value.endsWith("es") && value.length > 4) variants.add(value.slice(0, -2));
    if (value.endsWith("s") && value.length > 3) variants.add(value.slice(0, -1));
    if (value.endsWith("ly") && value.length > 4) variants.add(value.slice(0, -2));
    if (value.endsWith("tion") && value.length > 6) variants.add(value.slice(0, -4));
  }

  return new Set(Array.from(variants).filter((value) => value.length >= 3));
}

function normalizeSpelling(value) {
  return value
    .replace(/our/g, "or")
    .replace(/isation/g, "ization")
    .replace(/ising/g, "izing")
    .replace(/ised/g, "ized")
    .replace(/ise$/g, "ize")
    .replace(/yse$/g, "yze")
    .replace(/ogue$/g, "og")
    .replace(/amme/g, "am")
    .replace(/phre/g, "pher");
}

function compact(value) {
  return normalize(value).replace(/[^a-z]+/g, "");
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "get",
  "got",
  "had",
  "has",
  "have",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "out",
  "that",
  "the",
  "their",
  "them",
  "there",
  "they",
  "this",
  "to",
  "was",
  "were",
  "with",
  "your",
]);
