export function firstNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function parseCountRange(value) {
  const numbers = String(value || "").match(/\d+/g)?.map(Number) || [];
  if (!numbers.length) return { min: 0, max: 0 };
  return { min: numbers[0], max: numbers[numbers.length - 1] };
}

export function uniqueStrings(items) {
  return [...new Set(items.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))];
}

export function sentence(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

export function defaultResponsibilities(analysis) {
  return analysis.responsibilities?.length
    ? analysis.responsibilities
    : [`Deliver ${analysis.targetRole} responsibilities described in the job description.`];
}

export function responsibilityToBullet(responsibility, levelRules = {}, index = 0) {
  const text = String(responsibility || "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  if (isQualificationLine(text)) return "";

  if (/^(built|design(?:ed|ing)?|develop(?:ed|ing)?|implement(?:ed|ing)?|optimiz(?:ed|ing)?|integrat(?:ed|ing)?|automat(?:ed|ing)?|support(?:ed|ing)?|improv(?:ed|ing)?|collaborat(?:ed|ing)?|deliver(?:ed|ing)?|maintain(?:ed|ing)?|lead(?:ing)?|own(?:ed|ing)?|define(?:d|s)?|participat(?:ed|ing)?|ensur(?:ed|ing)?|perform(?:ed|ing)?)\b/i.test(text)) {
    const normalized = text.charAt(0).toUpperCase() + text.slice(1);
    return normalized.endsWith(".") ? normalized : `${normalized}.`;
  }

  const verbs = levelRules.writingStyle?.verbs || ["Delivered"];
  const verb = verbs[index % verbs.length] || verbs[0] || "Delivered";
  const normalized = text.charAt(0).toLowerCase() + text.slice(1);
  return `${verb} ${normalized}${normalized.endsWith(".") ? "" : "."}`;
}

function isQualificationLine(text) {
  return (
    /^(solid|strong|proven|excellent|good|deep)\s+(experience|background|knowledge|understanding)\b/i.test(text) ||
    /^\d+\+?\s+years?\b/i.test(text) ||
    /\b(must have|nice to have|required:|preferred:)\b/i.test(text)
  );
}

export function responsibilitiesToBullets(analysis, levelRules, index = 0) {
  const range = index === 0 ? levelRules.experienceBullets?.primary : levelRules.experienceBullets?.older;
  const { min, max } = parseCountRange(range);
  const target = max || min || 5;
  const responsibilities = defaultResponsibilities(analysis);
  const offset = index * Math.max(1, Math.floor(responsibilities.length / 3));
  const rotated = [...responsibilities.slice(offset), ...responsibilities.slice(0, offset)];
  const bullets = rotated.map((item) => responsibilityToBullet(item, levelRules, index)).filter(Boolean);

  if (bullets.length) {
    return bullets.slice(0, target);
  }

  const verbs = levelRules.writingStyle?.verbs || ["Delivered"];
  const verb = verbs[index % verbs.length] || verbs[0] || "Delivered";
  return [
    `${verb} ${analysis.targetRole} features using the primary technologies named in the job posting.`,
    `${verb} backend services, APIs, and integrations supporting production workflows in the ${analysis.domain || "target"} domain.`
  ].slice(0, target);
}

export function progressiveSkillSlice(skills, index, levelRules, limit) {
  const progressionLimits = levelRules.environmentProgression?.maxItemsByEntry || [];
  const target = limit || Number(progressionLimits[index] || firstNumber(levelRules.skills?.environmentItemsPerExperience) || 8);
  const offset = Math.max(0, index * 2);
  const scale = Math.max(4, target - index);
  return uniqueStrings(skills).slice(offset, offset + scale);
}

export function companyPlaceholder(index) {
  if (index === 0) return "Company from JD";
  if (index === 1) return "Prior relevant organization";
  return "Earlier relevant organization";
}
