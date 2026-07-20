import test from "node:test";
import assert from "node:assert/strict";
import {
  extractYDRSentenceCandidates,
  extractYoudaoBilingualCandidates,
} from "../scripts/ydr-source.mjs";

test("extractYoudaoBilingualCandidates returns paired English and Chinese examples", () => {
  const html = `
    <div id="bilingual" class="trans-container tab-content">
      <li>
        <p><span>Their</span><span> </span><span>life</span><span> </span><span>together</span><span> hasn't exactly been <b>a bed of roses</b>.</span></p>
        <p><span>他们在一起的生活并不十分幸福。</span></p>
        <p class="example-via"><a target=_blank rel="nofollow">《牛津词典》</a></p>
      </li>
      <li>
        <p><span>Unfortunately</span><span>, </span><span>life is not <b>a bed of roses</b>.</span></p>
        <p><span>不幸的是，生活并不是一帆风顺的。</span></p>
      </li>
    </div>
  `;

  assert.deepEqual(extractYoudaoBilingualCandidates(html), [
    {
      en: "Their life together hasn't exactly been a bed of roses.",
      zh: "他们在一起的生活并不十分幸福。",
    },
    {
      en: "Unfortunately, life is not a bed of roses.",
      zh: "不幸的是，生活并不是一帆风顺的。",
    },
  ]);
});

test("extractYDRSentenceCandidates keeps the English side of bilingual examples", () => {
  const html = `
    <div id="examples" class="trans-wrapper">
      <div id="bilingual" class="trans-container tab-content">
        <li>
          <p><span>The <b>4-H</b> girls planted trees and took care of them during the early stages of growth.</span></p>
          <p><span>“4-H 俱乐部”的女孩们参与植树，并在树木生长的初期照顾它们。</span></p>
        </li>
      </div>
    </div>
  `;

  assert.deepEqual(extractYDRSentenceCandidates(html), [
    "The 4-H girls planted trees and took care of them during the early stages of growth.",
  ]);
});
