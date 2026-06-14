import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyExample,
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

test("wordCount handles contractions and hyphenated words", () => {
  assert.equal(wordCount("Don't make a half-hearted promise."), 5);
});
