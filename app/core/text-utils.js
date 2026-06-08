export function normalize(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
}

export function tokenize(text) {
  const stopWords = new Set([
    "and", "the", "for", "with", "you", "are", "our", "will", "that", "this", "from", "have", "has", "into", "using",
    "work", "team", "teams", "role", "job", "your", "their", "they", "but", "not", "all", "can", "about", "within",
    "experience", "developer", "software", "engineer", "engineering", "development", "application", "applications",
    "candidate", "responsibilities", "requirements", "required", "preferred", "plus"
  ]);

  return normalize(text)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
