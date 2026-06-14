const SHORT_EXAMPLE_LIMIT = 7;

export function classifyExample({ term, example }) {
  const normalizedTerm = normalize(term);
  const normalizedExample = normalize(example);
  const count = wordCount(example);
  const isShort = count > 0 && count <= SHORT_EXAMPLE_LIMIT;
  const isMultiWordTerm = /\s/.test(normalizedTerm);

  const checks = [
    {
      reason: "bare-it-was-term",
      pattern: isMultiWordTerm
        ? new RegExp(`^it\\s+(was|is)\\s+${escapeRegExp(normalizedTerm)}\\.$`, "i")
        : /a^/,
    },
    {
      reason: "mechanical-adverb-response",
      pattern: /^[a-z-]+ly,\s+(she|he|they)\s+responded\.$/i,
    },
    {
      reason: "bare-it-was",
      pattern: /^it\s+(was|is)\s+(very\s+|quite\s+|really\s+)?[a-z-]+\.$/i,
    },
    {
      reason: "bare-subject-was",
      pattern: /^(the|a|an)\s+[a-z-]+\s+(was|is|were|are)\s+(very\s+|quite\s+|really\s+)?[a-z-]+\.$/i,
    },
    {
      reason: "generic-person-label",
      pattern: /^(she|he)\s+(was|is)\s+(a|an)\s+[a-z-]+\.$/i,
    },
    {
      reason: "embedded-numbering",
      pattern: /\b\d+\.\s+[a-z]/i,
    },
  ];

  const match = checks.find((check) => check.pattern.test(normalizedExample));

  return {
    isShort,
    isTemplate: Boolean(
      match &&
        normalizedExample.includes(normalizedTerm) &&
        (isShort || match.reason === "embedded-numbering"),
    ),
    reason: match?.reason || "",
    wordCount: count,
  };
}

export function sanitizeExamples({ term, examples }) {
  return examples.filter((example) => {
    const result = classifyExample({ term, example: example.en || "" });
    return !result.isTemplate;
  });
}

export function wordCount(value) {
  return (value.match(/[A-Za-z]+(?:[-'][A-Za-z]+)?/g) || []).length;
}

function normalize(value) {
  return value.toLowerCase().trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
