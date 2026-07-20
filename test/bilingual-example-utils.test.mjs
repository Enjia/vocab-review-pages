import test from "node:test";
import assert from "node:assert/strict";
import { pickBestBilingualCandidate } from "../scripts/bilingual-example-utils.mjs";

test("pickBestBilingualCandidate prefers the bilingual example matching the existing English sentence", () => {
  const selected = pickBestBilingualCandidate({
    term: "4-H",
    currentExampleEn: "The 4-H girls planted trees and took care of them during the early stages of growth.",
    candidates: [
      {
        en: "Farmington, Utah, is a more pleasant community since a local girls' 4-H club improved Main Street.",
        zh: "自从当地的一个女生4-H俱乐部改善了主街的状况，这个社区变得更加宜人。",
      },
      {
        en: "The 4-H girls planted trees and took care of them during the early stages of growth.",
        zh: "“4-H俱乐部”的女孩们参与植树，并在树木生长的初期照顾它们。",
      },
    ],
  });

  assert.deepEqual(selected, {
    en: "The 4-H girls planted trees and took care of them during the early stages of growth.",
    zh: "“4-H俱乐部”的女孩们参与植树，并在树木生长的初期照顾它们。",
  });
});

test("pickBestBilingualCandidate falls back to the first relevant bilingual example", () => {
  const selected = pickBestBilingualCandidate({
    term: "a bed of roses",
    currentExampleEn: "",
    candidates: [
      {
        en: "Their life together hasn't exactly been a bed of roses.",
        zh: "他们在一起的生活并不十分幸福。",
      },
      {
        en: "She likes roses in the garden.",
        zh: "她喜欢花园里的玫瑰。",
      },
    ],
  });

  assert.deepEqual(selected, {
    en: "Their life together hasn't exactly been a bed of roses.",
    zh: "他们在一起的生活并不十分幸福。",
  });
});
