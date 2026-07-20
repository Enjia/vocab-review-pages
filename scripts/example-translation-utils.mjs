export function extractGoogleTranslateText(payload) {
  if (!Array.isArray(payload)) return "";
  const segments = Array.isArray(payload[0]) ? payload[0] : [];
  return segments
    .map((segment) => (Array.isArray(segment) ? String(segment[0] || "") : ""))
    .join("")
    .trim();
}

export function extractMyMemoryText(payload) {
  return String(payload?.responseData?.translatedText || "").trim();
}

export function cleanMachineTranslation(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/gu, "")
    .replace(/(?<=[\u4e00-\u9fff])\s+(?=[，。！？；：、）】》])/gu, "")
    .replace(/(?<=[（【《“])\s+/gu, "")
    .replace(/\s+(?=[）】》”])/gu, "")
    .trim();
}
