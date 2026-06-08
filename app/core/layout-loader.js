const layoutPaths = {
  intern: "./layouts/intern.json",
  entry: "./layouts/entry.json",
  junior: "./layouts/junior.json",
  midlevel: "./layouts/midlevel.json",
  senior: "./layouts/senior.json"
};

const cache = new Map();

export async function loadLayoutBlueprint(level) {
  const normalizedLevel = layoutPaths[level] ? level : "midlevel";
  if (cache.has(normalizedLevel)) return cache.get(normalizedLevel);

  const response = await fetch(layoutPaths[normalizedLevel]);
  if (!response.ok) {
    throw new Error(`Unable to load layout blueprint: ${normalizedLevel}`);
  }

  const blueprint = await response.json();
  cache.set(normalizedLevel, blueprint);
  return blueprint;
}

export function getAvailableLayoutLevels() {
  return Object.keys(layoutPaths);
}
