import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("generated vocabulary entries have unique ids", async () => {
  const data = JSON.parse(await readFile(new URL("../data/words.json", import.meta.url), "utf8"));
  const ids = data.entries.map((entry) => entry.id);
  const uniqueIds = new Set(ids);

  assert.equal(uniqueIds.size, ids.length);
});
