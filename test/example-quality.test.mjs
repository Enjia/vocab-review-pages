import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyExample,
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

test("wordCount handles contractions and hyphenated words", () => {
  assert.equal(wordCount("Don't make a half-hearted promise."), 5);
});
