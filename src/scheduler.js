const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60];

export function buildModules(entries, moduleSize = 100, packSize = 20) {
  const modules = [];

  for (let index = 0; index < entries.length; index += moduleSize) {
    const moduleEntries = entries.slice(index, index + moduleSize);
    const moduleNumber = modules.length + 1;
    modules.push({
      id: `module-${String(moduleNumber).padStart(3, "0")}`,
      number: moduleNumber,
      title: `Module ${String(moduleNumber).padStart(3, "0")}`,
      subtitle: summarizeThemes(moduleEntries),
      entries: moduleEntries,
      packs: buildPacks(moduleEntries, moduleNumber, packSize),
    });
  }

  return modules;
}

export function getDueEntries(entries, progress, now = new Date()) {
  return entries.filter((entry) => {
    const item = progress[entry.id];
    return item?.dueAt && new Date(item.dueAt) <= now;
  });
}

export function getNewEntries(entries, progress, limit = 20) {
  return entries.filter((entry) => !progress[entry.id]).slice(0, limit);
}

export function getWeakEntries(entries, progress, limit = 40) {
  return entries.filter((entry) => progress[entry.id]?.status === "again").slice(0, limit);
}

export function nextReviewDate(status, reviewCount = 0, now = new Date()) {
  const days = status === "again" ? 1 : REVIEW_INTERVALS[Math.min(reviewCount, REVIEW_INTERVALS.length - 1)];
  const next = new Date(now);
  next.setDate(next.getDate() + days);
  return next;
}

function buildPacks(entries, moduleNumber, packSize) {
  const packs = [];

  for (let index = 0; index < entries.length; index += packSize) {
    const packEntries = entries.slice(index, index + packSize);
    const packNumber = packs.length + 1;
    packs.push({
      id: `module-${String(moduleNumber).padStart(3, "0")}-pack-${packNumber}`,
      number: packNumber,
      title: `Pack ${packNumber}`,
      entries: packEntries,
    });
  }

  return packs;
}

function summarizeThemes(entries) {
  const counts = new Map();
  for (const entry of entries) {
    if (!entry.theme) continue;
    counts.set(entry.theme, (counts.get(entry.theme) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([theme]) => theme)
    .join(" / ");
}
