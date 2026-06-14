import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("frontend examples render and search English examples only", async () => {
  const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.doesNotMatch(appSource, /example\.zh/);
  assert.doesNotMatch(appSource, /escapeHtml\(example\.zh\)/);
});

test("frontend shell uses English control copy", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, /中文|随机抽取|清空本地进度/);
  assert.match(html, /placeholder="term \/ definition \/ example"/);
  assert.match(html, /title="Shuffle"/);
  assert.match(html, /title="Reset progress"/);
});

test("frontend exposes night practice instead of realtime voice as the primary practice panel", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /Night Practice/);
  assert.match(html, /Copy ChatGPT prompt/);
  assert.match(html, /Practiced tonight/);
  assert.doesNotMatch(html, /Start voice coach/);
});

test("review card exposes four recall grades instead of a binary pass fail", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(html, />Again</);
  assert.match(html, />Hard</);
  assert.match(html, />Good</);
  assert.match(html, />Easy</);
  assert.doesNotMatch(html, />Known</);
  assert.match(appSource, /markCurrent\("again"\)/);
  assert.match(appSource, /markCurrent\("hard"\)/);
  assert.match(appSource, /markCurrent\("good"\)/);
  assert.match(appSource, /markCurrent\("easy"\)/);
});

test("word list card fronts do not render definitions or examples", async () => {
  const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  const renderListSource = appSource.slice(
    appSource.indexOf("function renderList()"),
    appSource.indexOf("function updateStats"),
  );

  assert.doesNotMatch(renderListSource, /entry\.definition/);
  assert.doesNotMatch(renderListSource, /entry\.examples/);
});

test("primary review typography uses fixed responsive sizes", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.doesNotMatch(styles, /h1\s*{[\s\S]*?clamp\(/);
  assert.doesNotMatch(styles, /#cardTerm\s*{[\s\S]*?clamp\(/);
  assert.match(styles, /h1\s*{[\s\S]*?font-size:\s*64px;/);
  assert.match(styles, /#cardTerm\s*{[\s\S]*?font-size:\s*56px;/);
});
