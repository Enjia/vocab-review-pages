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

test("parseVocabularyFile keeps legacy inline examples out of card terms", () => {
  const markdown = `# 旧格式

#### (get/have sb) over a barrel:（使某人）听从摆布，处于被动地位（They've got us over a barrel. Either we agree to their terms or we lose the money：他们让我们别无选择。我们要么答应他们的条件，要么损失这笔钱）

#### ˌread (sb) the Riot Act：警告（某人）不得做某事（I'm glad you read the riot act to Billy. He's still a kid and still needs to be told what to do：我很高兴你警告比利不许胡闹。他还是个孩子，仍然需要有人告诉他该做什么）
`;

  const entries = parseVocabularyFile({
    filePath: "/vault/Project/背单词/固定搭配_习语/动词.md",
    vaultRoot: "/vault",
    markdown,
  });

  assert.deepEqual(
    entries.map((entry) => entry.term),
    ["(get/have sb) over a barrel", "read (sb) the Riot Act"],
  );
  assert.equal(entries[0].definition, "（使某人）听从摆布，处于被动地位");
  assert.equal(entries[0].examples[0].en, "They've got us over a barrel. Either we agree to their terms or we lose the money");
});

test("parseVocabularyFile extracts target terms from quoted dictionary sentence headings", () => {
  const markdown = `# 旧格式

#### 'If you take the car, I won't be able to go out.' 'Tough luck!'

#### 'But I've only just got here,' he bleated feebly

#### "It's too late," he said tersely

#### "Well..." she began haltingly

#### "You can rant and rave all you want," she said, "but it's not going to change things."
`;

  const entries = parseVocabularyFile({
    filePath: "/vault/Project/背单词/固定搭配_习语/动词.md",
    vaultRoot: "/vault",
    markdown,
  });

  assert.deepEqual(
    entries.map((entry) => entry.term),
    ["tough luck", "bleated feebly", "tersely", "haltingly", "rant and rave"],
  );
});

test("parseVocabularyFile recovers examples from truncated legacy inline headings", () => {
  const markdown = `# 旧格式

#### (get/have sb) over a barrel:（使某人）听从摆布，处于被动地位（They've got us over a barrel. Either we agree to their terms or we lose the money
- 释义：他们让我们别无选择。我们要么答应他们的条件，要么损失这笔钱）
`;

  const entries = parseVocabularyFile({
    filePath: "/vault/Project/背单词/句式模板_动词/选择_优先_取舍.md",
    vaultRoot: "/vault",
    markdown,
  });

  assert.equal(entries[0].term, "(get/have sb) over a barrel");
  assert.equal(entries[0].definition, "他们让我们别无选择。我们要么答应他们的条件，要么损失这笔钱");
  assert.equal(entries[0].examples[0].en, "They've got us over a barrel. Either we agree to their terms or we lose the money");
});
