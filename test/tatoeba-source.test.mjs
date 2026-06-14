import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseTatoebaSentence,
  normalizeTermForSearch,
} from "../scripts/tatoeba-source.mjs";

test("normalizeTermForSearch keeps hyphenated terms searchable", () => {
  assert.equal(normalizeTermForSearch("hard-and-fast"), "hard-and-fast");
});

test("chooseTatoebaSentence prefers exact non-template matches", () => {
  const result = chooseTatoebaSentence("solemnly", [
    {
      id: 1,
      text: "Solemnly, she responded.",
      lang: "eng",
      license: "CC BY 2.0 FR",
      user: { username: "bad" },
    },
    {
      id: 2,
      text: "The anchorman delivered the news solemnly.",
      lang: "eng",
      license: "CC BY 2.0 FR",
      user: { username: "good" },
    },
  ]);

  assert.equal(result.id, 2);
});

test("chooseTatoebaSentence rejects sentences that omit the target term", () => {
  const result = chooseTatoebaSentence("stakeholder", [
    {
      id: 3,
      text: "He consults with stakeholders regularly.",
      lang: "eng",
      license: "CC0 1.0",
      user: { username: "plural" },
    },
  ]);

  assert.equal(result, null);
});
