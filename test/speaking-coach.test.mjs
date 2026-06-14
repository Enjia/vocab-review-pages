import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPracticePayload,
  getRealtimeClientSecret,
  selectPracticeEntries,
} from "../src/speaking-coach.js";

test("selectPracticeEntries prioritizes current card and caps the selected set", () => {
  const current = { id: "2", term: "ineffable", definition: "难以言表", examples: [{ en: "The view was ineffable." }] };
  const entries = [
    { id: "1", term: "stakeholder", definition: "利益相关者" },
    current,
    { id: "3", term: "perfunctory", definition: "敷衍的" },
  ];

  const selected = selectPracticeEntries({ current, entries, limit: 2 });

  assert.deepEqual(
    selected.map((entry) => entry.term),
    ["ineffable", "stakeholder"],
  );
});

test("buildPracticePayload sends compact vocabulary context only", () => {
  const payload = buildPracticePayload({
    mode: "module",
    module: { title: "Module 001" },
    pack: { title: "Pack 1" },
    current: { id: "1", term: "stakeholder" },
    entries: [
      {
        id: "1",
        term: "stakeholder",
        definition: "利益相关者",
        examples: [{ en: "Every stakeholder agreed.", zh: "每个利益相关者都同意了。" }],
        sourcePath: "private/path.md",
      },
    ],
  });

  assert.equal(payload.mode, "module");
  assert.equal(payload.moduleId, "Module 001");
  assert.equal(payload.packId, "Pack 1");
  assert.deepEqual(payload.words, [
    {
      term: "stakeholder",
      definition: "利益相关者",
      example: "Every stakeholder agreed.",
    },
  ]);
  assert.doesNotMatch(JSON.stringify(payload), /sourcePath|zh|private/);
});

test("getRealtimeClientSecret accepts supported OpenAI response shapes", () => {
  assert.equal(getRealtimeClientSecret({ clientSecret: "local" }), "local");
  assert.equal(getRealtimeClientSecret({ client_secret: { value: "openai" } }), "openai");
});
