import test from "node:test";
import assert from "node:assert/strict";
import {
  buildModules,
  getDueEntries,
  getNewEntries,
  getWeakEntries,
  nextReviewDate,
} from "../src/scheduler.js";

test("buildModules groups entries into 100-card modules and 20-card packs", () => {
  const entries = Array.from({ length: 205 }, (_, index) => ({
    id: `id-${index}`,
    theme: index < 100 ? "Theme A" : "Theme B",
  }));

  const modules = buildModules(entries);

  assert.equal(modules.length, 3);
  assert.equal(modules[0].entries.length, 100);
  assert.equal(modules[0].packs.length, 5);
  assert.equal(modules[0].packs[0].entries.length, 20);
  assert.equal(modules[2].entries.length, 5);
});

test("getDueEntries returns entries whose due date is today or earlier", () => {
  const entries = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const progress = {
    a: { dueAt: "2026-06-13T00:00:00.000Z" },
    b: { dueAt: "2026-06-15T00:00:00.000Z" },
  };

  const due = getDueEntries(entries, progress, new Date("2026-06-14T00:00:00.000Z"));

  assert.deepEqual(
    due.map((entry) => entry.id),
    ["a"],
  );
});

test("getNewEntries returns unseen entries only", () => {
  const entries = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const progress = {
    a: { status: "known" },
  };

  assert.deepEqual(
    getNewEntries(entries, progress, 2).map((entry) => entry.id),
    ["b", "c"],
  );
});

test("getWeakEntries keeps failed and effortful cards in the weak queue", () => {
  const entries = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const progress = {
    a: { status: "again" },
    b: { status: "hard" },
    c: { status: "good" },
    d: { status: "easy" },
  };

  assert.deepEqual(
    getWeakEntries(entries, progress, 10).map((entry) => entry.id),
    ["a", "b"],
  );
});

test("nextReviewDate spaces again, hard, good, and easy in ascending order", () => {
  const now = new Date("2026-06-14T00:00:00.000Z");

  assert.equal(nextReviewDate("again", 0, now).toISOString(), "2026-06-14T00:10:00.000Z");
  assert.equal(nextReviewDate("hard", 0, now).toISOString(), "2026-06-15T00:00:00.000Z");
  assert.equal(nextReviewDate("good", 2, now).toISOString(), "2026-06-21T00:00:00.000Z");
  assert.equal(nextReviewDate("easy", 2, now).toISOString(), "2026-06-28T00:00:00.000Z");
});
