const state = {
  data: null,
  entries: [],
  filtered: [],
  current: null,
  revealed: false,
  mode: "all",
  progress: loadProgress(),
};

const els = {
  search: document.querySelector("#searchInput"),
  type: document.querySelector("#typeFilter"),
  pos: document.querySelector("#posFilter"),
  theme: document.querySelector("#themeFilter"),
  total: document.querySelector("#totalCount"),
  known: document.querySelector("#knownCount"),
  again: document.querySelector("#againCount"),
  filtered: document.querySelector("#filteredCount"),
  list: document.querySelector("#wordList"),
  cardType: document.querySelector("#cardType"),
  cardTheme: document.querySelector("#cardTheme"),
  cardTerm: document.querySelector("#cardTerm"),
  answer: document.querySelector("#answerPanel"),
  definition: document.querySelector("#definitionText"),
  examples: document.querySelector("#exampleBlock"),
  links: document.querySelector("#linkBlock"),
  show: document.querySelector("#showAnswerButton"),
  againButton: document.querySelector("#againButton"),
  knownButton: document.querySelector("#knownButton"),
  shuffle: document.querySelector("#shuffleButton"),
  reset: document.querySelector("#resetProgressButton"),
  modeGroup: document.querySelector("#modeGroup"),
};

init();

async function init() {
  const response = await fetch("./data/words.json");
  state.data = await response.json();
  state.entries = state.data.entries;
  populateFilters();
  bindEvents();
  applyFilters();
  pickRandom();
}

function populateFilters() {
  fillSelect(els.type, "All types", state.data.facets.expressionTypes);
  fillSelect(els.pos, "All parts", state.data.facets.partsOfSpeech);
  fillSelect(els.theme, "All themes", state.data.facets.themes);
}

function fillSelect(select, label, items) {
  select.innerHTML = "";
  select.append(new Option(label, ""));
  for (const item of items) {
    select.append(new Option(`${item.name} (${item.count})`, item.name));
  }
}

function bindEvents() {
  for (const input of [els.search, els.type, els.pos, els.theme]) {
    input.addEventListener("input", () => {
      applyFilters();
      pickRandom();
    });
  }

  els.modeGroup.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    state.mode = button.dataset.mode;
    for (const item of els.modeGroup.querySelectorAll("button")) {
      item.classList.toggle("is-active", item === button);
    }
    applyFilters();
    pickRandom();
  });

  els.show.addEventListener("click", () => {
    if (!state.current) return;
    state.revealed = !state.revealed;
    renderCard();
  });
  document.querySelector("#termButton").addEventListener("click", reveal);
  els.shuffle.addEventListener("click", pickRandom);
  els.knownButton.addEventListener("click", () => markCurrent("known"));
  els.againButton.addEventListener("click", () => markCurrent("again"));
  els.reset.addEventListener("click", () => {
    state.progress = {};
    saveProgress();
    updateStats();
    renderList();
  });
}

function applyFilters() {
  const query = normalize(els.search.value);
  state.filtered = state.entries.filter((entry) => {
    if (els.type.value && entry.expressionType !== els.type.value) return false;
    if (els.pos.value && entry.partOfSpeech !== els.pos.value) return false;
    if (els.theme.value && entry.theme !== els.theme.value) return false;

    const progress = state.progress[entry.id]?.status;
    if (state.mode === "unseen" && progress) return false;
    if (state.mode === "weak" && progress !== "again") return false;

    if (!query) return true;
    return normalize(
      `${entry.term} ${entry.definition} ${entry.theme} ${entry.examples
        .map((example) => `${example.en} ${example.zh}`)
        .join(" ")}`,
    ).includes(query);
  });

  updateStats();
  renderList();
}

function pickRandom() {
  if (!state.filtered.length) {
    renderEmptyCard();
    return;
  }

  const index = Math.floor(Math.random() * state.filtered.length);
  setCurrent(state.filtered[index]);
}

function setCurrent(entry) {
  state.current = entry;
  state.revealed = false;
  renderCard();
  renderList();
}

function reveal() {
  state.revealed = true;
  renderCard();
}

function markCurrent(status) {
  if (!state.current) return;
  state.progress[state.current.id] = {
    status,
    updatedAt: new Date().toISOString(),
  };
  saveProgress();
  updateStats();
  renderList();
  pickRandom();
}

function renderCard() {
  const entry = state.current;
  if (!entry) {
    renderEmptyCard();
    return;
  }

  els.cardType.textContent = [entry.expressionType, entry.partOfSpeech].filter(Boolean).join(" / ");
  els.cardTheme.textContent = entry.theme || "Unsorted";
  els.cardTerm.textContent = entry.term;
  els.answer.hidden = !state.revealed;
  els.show.textContent = state.revealed ? "Hide answer" : "Show answer";

  els.definition.textContent = entry.definition || "No definition yet.";
  els.examples.innerHTML = entry.examples
    .slice(0, 3)
    .map(
      (example) => `
        <div class="example">
          <strong>${escapeHtml(example.en)}</strong>
          ${example.zh ? `<span>${escapeHtml(example.zh)}</span>` : ""}
        </div>
      `,
    )
    .join("");
  els.links.textContent = [entry.sourcePath, entry.relatedTerms.length ? `Related: ${entry.relatedTerms.slice(0, 8).join(", ")}` : ""]
    .filter(Boolean)
    .join(" · ");
}

function renderEmptyCard() {
  state.current = null;
  els.cardType.textContent = "No cards";
  els.cardTheme.textContent = "Adjust filters";
  els.cardTerm.textContent = "No matching entries";
  els.definition.textContent = "";
  els.examples.innerHTML = "";
  els.links.textContent = "";
  els.answer.hidden = true;
}

function renderList() {
  els.filtered.textContent = `${state.filtered.length.toLocaleString()} cards`;
  const items = state.filtered.slice(0, 120);
  els.list.innerHTML = items
    .map((entry) => {
      const active = state.current?.id === entry.id;
      const progress = state.progress[entry.id]?.status;
      return `
        <button class="word-item ${active ? "is-active" : ""}" data-id="${escapeHtml(entry.id)}">
          <strong>${escapeHtml(entry.term)}</strong>
          <span>${escapeHtml(entry.definition || entry.theme || "")}</span>
          <span>${progress ? progressLabel(progress) : "unseen"}</span>
        </button>
      `;
    })
    .join("");

  for (const button of els.list.querySelectorAll(".word-item")) {
    button.addEventListener("click", () => {
      const entry = state.entries.find((item) => item.id === button.dataset.id);
      if (entry) setCurrent(entry);
    });
  }
}

function updateStats() {
  const values = Object.values(state.progress);
  els.total.textContent = state.entries.length.toLocaleString();
  els.known.textContent = values.filter((item) => item.status === "known").length.toLocaleString();
  els.again.textContent = values.filter((item) => item.status === "again").length.toLocaleString();
}

function normalize(value) {
  return value.toLowerCase().trim();
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem("vocab-review-progress") || "{}");
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem("vocab-review-progress", JSON.stringify(state.progress));
}

function progressLabel(progress) {
  return progress === "known" ? "known" : "again";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
