const PEARSON_ENDPOINT = "https://api.pearson.com/v2/dictionaries/entries";
const RESPONSE_TIMEOUT_MS = 12000;

export async function fetchPearsonCandidates(term, fetchImpl = defaultFetch) {
  const query = normalizeQuery(term);
  if (!query) return [];

  const url = `${PEARSON_ENDPOINT}?headword=${encodeURIComponent(query)}&limit=10`;
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(RESPONSE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Pearson request failed for ${term}: ${response.status}`);
  }

  const payload = await response.json();
  return extractExamplesFromPayload(payload, term);
}

export function extractPearsonCandidates(payload) {
  return extractExamplesFromPayload(payload);
}

function extractExamplesFromPayload(payload, fallbackTerm) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const examples = [];

  for (const entry of results) {
    const senses = Array.isArray(entry?.senses) ? entry.senses : [];
    const lexicalUnits = Array.isArray(entry?.lexical_unit) ? entry.lexical_unit : [];

    for (const lexical of lexicalUnits) {
      for (const sense of toArray(lexical?.senses)) {
        collectSenseExamples(sense, examples);
      }
    }

    const usageBox = entry?.usage_box;
    for (const sense of toArray(usageBox?.senses)) {
      collectSenseExamples(sense, examples);
    }

    for (const sense of senses) {
      collectSenseExamples(sense, examples);
      for (const key of ["lexical_box", "collocation_examples"]) {
        for (const item of toArray(sense?.[key])) {
          if (key === "lexical_box") {
            for (const nested of toArray(item?.senses)) {
              collectSenseExamples(nested, examples);
            }
            continue;
          }

          collectFreeExample(item?.example, examples);
        }
      }

      for (const translation of toArray(sense?.translations)) {
        for (const example of toArray(translation?.example)) {
          collectFreeExample(example, examples);
        }
      }

      for (const translation of toArray(sense?.grammatical_examples)) {
        collectFreeExample(translation, examples);
      }
    }

    for (const sense of senses) {
      collectSenseExamples(sense, examples);
    }

    for (const translation of toArray(entry?.translations)) {
      for (const example of toArray(translation?.example)) {
        collectFreeExample(example, examples);
      }
    }
  }

  return dedupeOrdered(examples.map((value) => sanitizeText(String(value))).filter((value) => isLikelyEnglish(value)));
}

function collectSenseExamples(sense, out) {
  for (const example of toArray(sense?.examples)) {
    collectFreeExample(example, out);
  }

  for (const gram of toArray(sense?.grammatical_examples)) {
    collectFreeExample(gram, out);
  }

  for (const item of toArray(sense?.lexical_box)) {
    for (const nested of toArray(item?.senses)) {
      collectSenseExamples(nested, out);
    }
  }

  for (const item of toArray(sense?.translation_examples)) {
    collectFreeExample(item, out);
  }
}

function collectFreeExample(example, out) {
  if (!example) return;

  if (typeof example === "string") {
    const text = sanitizeText(example);
    if (text) out.push(text);
    return;
  }

  if (Array.isArray(example)) {
    for (const item of example) {
      collectFreeExample(item, out);
    }
    return;
  }

  if (typeof example === "object") {
    if (typeof example.text === "string") {
      out.push(sanitizeText(example.text));
    }

    if (typeof example.example?.text === "string") {
      out.push(sanitizeText(example.example.text));
    }

    for (const exampleText of toArray(example?.example)) {
      collectFreeExample(exampleText, out);
    }

    for (const key of ["examples", "example", "translation", "translations"]) {
      if (key in example && key !== "example") {
        for (const entry of toArray(example[key])) {
          collectFreeExample(entry, out);
        }
      }
    }
  }
}

function isLikelyEnglish(value) {
  return /[A-Za-z]/.test(value) && !/[\p{Script=Han}]/u.test(value) && wordCount(value) >= 3;
}

function toArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function sanitizeText(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeQuery(value) {
  return String(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function dedupeOrdered(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

function wordCount(value) {
  return (String(value).match(/[A-Za-z]+(?:[-'][A-Za-z]+)?/g) || []).length;
}

async function defaultFetch(url, options) {
  return fetch(url, options);
}
