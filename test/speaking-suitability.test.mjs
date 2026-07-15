import test from "node:test";
import assert from "node:assert/strict";
import { classifySpeakingSuitability } from "../scripts/speaking-suitability.mjs";

test("speaking suitability keeps everyday expressions active", () => {
  assert.equal(
    classifySpeakingSuitability({
      term: "make up for",
      examples: [{ en: "I will make up for the lost time." }],
    }),
    "active",
  );
});

test("speaking suitability marks templates, unsupported entries, and literary constructions for recognition", () => {
  assert.equal(classifySpeakingSuitability({ term: "(get/have sb) over a barrel" }), "recognition");
  assert.equal(classifySpeakingSuitability({ term: "a child reared on self-indulgence" }), "recognition");
  assert.equal(classifySpeakingSuitability({ term: "a few husks of reason" }), "recognition");
  assert.equal(classifySpeakingSuitability({ term: "keep an eye on", examples: [] }), "recognition");
});

test("speaking suitability marks insults and sensitive terms as caution", () => {
  assert.equal(classifySpeakingSuitability({ term: "a bratty kid" }), "caution");
  assert.equal(classifySpeakingSuitability({ term: "work your ass off" }), "caution");
});
