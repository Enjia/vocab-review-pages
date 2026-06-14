import test from "node:test";
import assert from "node:assert/strict";
import {
  backfillExamplesByTerm,
  classifyExample,
  normalizeEntryExamples,
  sanitizeExamples,
  wordCount,
} from "../scripts/example-quality.mjs";

test("classifyExample flags mechanical adverb response examples", () => {
  const result = classifyExample({
    term: "solemnly",
    example: "Solemnly, she responded.",
  });

  assert.equal(result.isShort, true);
  assert.equal(result.isTemplate, true);
  assert.equal(result.reason, "mechanical-adverb-response");
});

test("classifyExample flags bare it-was examples", () => {
  const result = classifyExample({
    term: "ineffable",
    example: "It was ineffable.",
  });

  assert.equal(result.isTemplate, true);
  assert.equal(result.reason, "bare-it-was");
});

test("classifyExample keeps natural short idioms", () => {
  const result = classifyExample({
    term: "case",
    example: "I rest my case.",
  });

  assert.equal(result.isShort, true);
  assert.equal(result.isTemplate, false);
});

test("classifyExample flags bare it-was phrase examples", () => {
  const result = classifyExample({
    term: "a case in point",
    example: "It was a case in point.",
  });

  assert.equal(result.isTemplate, true);
  assert.equal(result.reason, "bare-it-was-term");
});

test("sanitizeExamples removes template and numbered examples", () => {
  const sanitized = sanitizeExamples({
    term: "a case in point",
    examples: [
      { en: "It was a case in point.", zh: "那是例证。" },
      { en: "The 151. a case in point was mentioned in the report", zh: "报告中提到了例证" },
      { en: "The collapse of the exchange rate is a case in point.", zh: "汇率崩盘就是一个例子。" },
    ],
  });

  assert.deepEqual(sanitized, [
    { en: "The collapse of the exchange rate is a case in point.", zh: "汇率崩盘就是一个例子。" },
  ]);
});

test("sanitizeExamples removes mismatched glossary examples", () => {
  const sanitized = sanitizeExamples({
    term: "beanpole",
    examples: [
      { en: "a tall and thin person", zh: "瘦高个子" },
      { en: "His brother is such a beanpole that he struggles to find jackets that fit.", zh: "" },
    ],
  });

  assert.deepEqual(sanitized, [
    {
      en: "His brother is such a beanpole that he struggles to find jackets that fit.",
      zh: "",
    },
  ]);
});

test("sanitizeExamples keeps inflected and spelling-variant matches", () => {
  const sanitized = sanitizeExamples({
    term: "acclimate",
    examples: [
      { en: "She was fine once she had acclimatized herself to the cold", zh: "" },
    ],
  });

  assert.deepEqual(sanitized, [
    {
      en: "She was fine once she had acclimatized herself to the cold",
      zh: "",
    },
  ]);
});

test("sanitizeExamples rejects partial matches for multi-word collocations", () => {
  const sanitized = sanitizeExamples({
    term: "a publicity stunt",
    examples: [
      { en: "Don't you ever pull a stunt like that again", zh: "" },
      { en: "The mayor dismissed the announcement as a publicity stunt.", zh: "" },
    ],
  });

  assert.deepEqual(sanitized, [
    {
      en: "The mayor dismissed the announcement as a publicity stunt.",
      zh: "",
    },
  ]);
});

test("sanitizeExamples removes definitional stubs and gloss fragments", () => {
  const sanitized = sanitizeExamples({
    term: "airtime",
    examples: [
      { en: "two hours before air time", zh: "" },
      { en: "The producer warned us that we were live in two minutes of airtime.", zh: "" },
    ],
  });

  assert.deepEqual(sanitized, [
    {
      en: "The producer warned us that we were live in two minutes of airtime.",
      zh: "",
    },
  ]);
});

test("sanitizeExamples removes noun-phrase slash fragments", () => {
  const sanitized = sanitizeExamples({
    term: "good-natured",
    examples: [
      { en: "a good-natured person/discussion", zh: "" },
      { en: "Everyone appreciated her good-natured response to the criticism.", zh: "" },
    ],
  });

  assert.deepEqual(sanitized, [
    {
      en: "Everyone appreciated her good-natured response to the criticism.",
      zh: "",
    },
  ]);
});

test("normalizeEntryExamples promotes embedded bilingual examples from definition", () => {
  const normalized = normalizeEntryExamples({
    term: "a climate of",
    definition:
      "一种...的气氛（The arrest of Senator Pinochet has created a climate of preoccupation among our citizens：对参议员皮诺切特的逮捕引起了我国公民的极大专注）",
    examples: [],
  });

  assert.equal(normalized.definition, "一种...的气氛");
  assert.deepEqual(normalized.examples, [
    {
      en: "The arrest of Senator Pinochet has created a climate of preoccupation among our citizens",
      zh: "对参议员皮诺切特的逮捕引起了我国公民的极大专注",
    },
  ]);
});

test("normalizeEntryExamples keeps glossary parentheses inside definition", () => {
  const normalized = normalizeEntryExamples({
    term: "acute",
    definition: "剧烈的（acute challenges）",
    examples: [],
  });

  assert.equal(normalized.definition, "剧烈的（acute challenges）");
  assert.deepEqual(normalized.examples, []);
});

test("normalizeEntryExamples sanitizes extracted definitional stubs", () => {
  const normalized = normalizeEntryExamples({
    term: "4-H",
    definition: "四健会（of or relating to a government program in the U.S.）",
    examples: [],
  });

  assert.equal(normalized.definition, "四健会");
  assert.deepEqual(normalized.examples, []);
});

test("backfillExamplesByTerm copies surviving examples to duplicate terms", () => {
  const entries = backfillExamplesByTerm([
    {
      id: "a",
      term: "a case in point",
      examples: [{ en: "That collapse is a case in point.", zh: "那次崩盘就是一个例子。" }],
    },
    {
      id: "b",
      term: "a case in point",
      examples: [],
    },
  ]);

  assert.deepEqual(entries[1].examples, [
    {
      en: "That collapse is a case in point.",
      zh: "那次崩盘就是一个例子。",
    },
  ]);
});

test("normalizeEntryExamples extracts examples from unclosed parentheses", () => {
  const normalized = normalizeEntryExamples({
    term: "lay hands on",
    definition: "得到，找到（I would read any book I could lay my hands on.",
    examples: [],
  });

  assert.equal(normalized.definition, "得到，找到");
  assert.deepEqual(normalized.examples, [
    {
      en: "I would read any book I could lay my hands on.",
      zh: "",
    },
  ]);
});

test("normalizeEntryExamples drops eg snippets that do not match the term", () => {
  const normalized = normalizeEntryExamples({
    term: "conversation fodder",
    definition:
      "谈资（fodder：饲料，素材，eg. Without education, these children will end up as factory fodder：不受教育，这些孩子将来只能到工厂干活）",
    examples: [],
  });

  assert.equal(normalized.definition, "谈资");
  assert.deepEqual(normalized.examples, []);
});

test("normalizeEntryExamples keeps long sourced examples from definitions", () => {
  const normalized = normalizeEntryExamples({
    term: "go so far as to do sth",
    definition:
      "竟然做出了...的举动（John Guest, one of the key leaders in Pittsburgh-area evangelical work, went so far as to describe her as the most brilliant youth organizer in Pennsylvania）",
    examples: [],
  });

  assert.equal(normalized.definition, "竟然做出了...的举动");
  assert.deepEqual(normalized.examples, [
    {
      en: "John Guest, one of the key leaders in Pittsburgh-area evangelical work, went so far as to describe her as the most brilliant youth organizer in Pennsylvania",
      zh: "",
    },
  ]);
});

test("wordCount handles contractions and hyphenated words", () => {
  assert.equal(wordCount("Don't make a half-hearted promise."), 5);
});
