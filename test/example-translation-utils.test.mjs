import test from "node:test";
import assert from "node:assert/strict";
import {
  extractGoogleTranslateText,
  extractMyMemoryText,
  cleanMachineTranslation,
} from "../scripts/example-translation-utils.mjs";

test("extractGoogleTranslateText reads the leading translated string", () => {
  const payload = [
    [
      [
        "那对年轻夫妇仍然拴在父母的围裙带上。",
        "That young couple are still tied to their parent's apron strings.",
      ],
    ],
  ];

  assert.equal(
    extractGoogleTranslateText(payload),
    "那对年轻夫妇仍然拴在父母的围裙带上。",
  );
});

test("cleanMachineTranslation normalizes spacing around Chinese punctuation", () => {
  const input = "那对 年轻 夫妇 仍然 拴 在 父母 的 围裙带 上 。";

  assert.equal(cleanMachineTranslation(input), "那对年轻夫妇仍然拴在父母的围裙带上。");
});

test("extractMyMemoryText reads translatedText from responseData", () => {
  const payload = {
    responseData: {
      translatedText: "那对年轻夫妇仍然被绑在父母的围裙上。",
    },
  };

  assert.equal(extractMyMemoryText(payload), "那对年轻夫妇仍然被绑在父母的围裙上。");
});
