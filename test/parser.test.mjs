import test from "node:test";
import assert from "node:assert/strict";
import { parseVocabularyFile, parsePathMeta } from "../scripts/parser.mjs";

test("parsePathMeta extracts expression type, part of speech, and theme", () => {
  const meta = parsePathMeta(
    "/vault/Project/背单词/单词形容词/态度_立场_观点.md",
  );

  assert.deepEqual(meta, {
    expressionType: "单词",
    partOfSpeech: "形容词",
    theme: "态度/立场/观点",
  });
});

test("parseVocabularyFile extracts entries with definitions, examples, and links", () => {
  const markdown = `# 语义场：态度/立场/观点

#### recalcitrant
- 释义：反抗的，不服从命令的
- 例句：
  - The danger is that recalcitrant local authorities will reject their responsibilities：危险在于抗命不遵的地方当局将拒绝履行他们的职责
- 关联： #同义 [[Project/背单词/单词形容词/其他_杂项.md#intransigent|intransigent]] #词根 [[Hub/词根_sist|词根_sist]]

#### pro-choice
- 释义：提倡堕胎合法的
- 关联： #词根 [[Hub/词根_choice|词根_choice]]

#### .the key instigators of reform
- 释义：改革的关键推动者
`;

  const entries = parseVocabularyFile({
    filePath: "/vault/Project/背单词/单词形容词/态度_立场_观点.md",
    vaultRoot: "/vault",
    markdown,
  });

  assert.equal(entries.length, 3);
  assert.equal(entries[0].term, "recalcitrant");
  assert.equal(entries[0].definition, "反抗的，不服从命令的");
  assert.equal(entries[0].examples.length, 1);
  assert.equal(entries[0].examples[0].en, "The danger is that recalcitrant local authorities will reject their responsibilities");
  assert.equal(entries[0].examples[0].zh, "危险在于抗命不遵的地方当局将拒绝履行他们的职责");
  assert.deepEqual(entries[0].tags, ["同义", "词根"]);
  assert.deepEqual(entries[0].relatedTerms, ["intransigent", "词根_sist"]);
  assert.equal(entries[0].expressionType, "单词");
  assert.equal(entries[0].partOfSpeech, "形容词");
  assert.equal(entries[0].theme, "态度/立场/观点");
  assert.equal(entries[2].term, "the key instigators of reform");
});
