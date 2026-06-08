const rulesPath = "./rules/resume-level-rules.json";
let cache;

export async function loadResumeLevelRules(level) {
  if (!cache) {
    const response = await fetch(rulesPath);
    if (!response.ok) throw new Error("Unable to load resume level rules.");
    cache = await response.json();
  }

  const selectedLevel = cache.levels[level] ? level : "midlevel";
  return {
    globalRules: cache.globalRules,
    levelRules: cache.levels[selectedLevel],
    level: selectedLevel
  };
}
