import {
  companyPlaceholder,
  firstNumber,
  parseCountRange,
  progressiveSkillSlice,
  responsibilitiesToBullets,
  uniqueStrings
} from "./resume-content.js";

export function normalizeAiResume(resume, analysis, blueprint, generationRules, options = {}) {
  const levelRules = generationRules.levelRules || {};
  const expectedExperienceCount = Number(levelRules.experienceEntries || 1);
  const expectedProjectCount = Number(levelRules.projectCount || 0);

  resume.meta = {
    ...resume.meta,
    mode: "ideal",
    level: analysis.level,
    layout: blueprint.level,
    targetRole: analysis.targetRole,
    companyName: analysis.companyName || "",
    location: analysis.location || "",
    domain: analysis.domain || "",
    matchedSkills: uniqueStrings([
      ...(analysis.requiredSkills || []),
      ...(analysis.preferredSkills || []),
      ...(resume.meta?.matchedSkills || [])
    ]),
    generatedBy: "ai"
  };

  resume.header = options.preserveHeader
    ? {
      ...resume.header,
      ...options.preserveHeader,
      targetRole: options.preserveHeader.targetRole || analysis.targetRole,
      location: options.preserveHeader.location || resume.header?.location || "Location"
    }
    : {
      ...resume.header,
      name: "Ideal Candidate",
      targetRole: analysis.targetRole,
      location: resume.header?.location || "Location"
    };

  resume.sections.workExperience = padExperienceEntries(resume.sections.workExperience, analysis, levelRules, expectedExperienceCount)
    .slice(0, expectedExperienceCount)
    .map((experience, index) => ({
      ...experience,
      company: normalizeCompanyName(experience.company, index),
      location: normalizeExperienceLocation(experience.location),
      dates: getDateRangeForLevel(levelRules, index),
      title: experience.title || levelRules.experienceTitles?.[index] || analysis.targetRole,
      environment: normalizeEnvironment(experience.environment, resume.meta.matchedSkills, levelRules, index),
      bullets: normalizeBullets(experience.bullets, levelRules, index, analysis)
    }));

  resume.sections.workExperience = dedupeExperienceBullets(resume.sections.workExperience);
  resume.sections.workExperience = ensureMinimumExperienceBullets(resume.sections.workExperience, analysis, levelRules);

  const totalYears = clampExperienceYears(calculateExperienceYears(resume.sections.workExperience), levelRules);
  resume.sections.professionalSummary = sanitizeSummary(resume.sections.professionalSummary, analysis);

  resume.sections.professionalSummary = normalizeSummaryYears(resume.sections.professionalSummary, totalYears, levelRules);

  if (options.preserveEducation) {
    resume.sections.education = options.preserveEducation;
  }

  resume.sections.projects = padProjects(resume.sections.projects, analysis, resume.meta.matchedSkills, expectedProjectCount)
    .slice(0, expectedProjectCount)
    .map((project) => ({
      ...project,
      bullets: normalizeProjectBullets(project.bullets, levelRules, analysis)
    }));

  resume.sections.skills = normalizeSkillGroups(resume.sections.skills, resume.meta.matchedSkills, levelRules);

  return resume;
}

function normalizeCompanyName(company, index) {
  const value = String(company || "").split(/\s+\|\s+/)[0].trim();
  if (!value || /company from jd|prior relevant|earlier relevant|confidential/i.test(value)) {
    return companyPlaceholder(index);
  }
  return value;
}

function normalizeExperienceLocation(location) {
  const value = String(location || "").trim();
  if (value && !/^location$/i.test(value)) return value;
  return "Location";
}

function padExperienceEntries(experiences, analysis, levelRules, expectedCount) {
  const result = [...(experiences || [])];
  while (result.length < expectedCount) {
    const index = result.length;
    result.push({
      company: companyPlaceholder(index),
      location: "Location",
      title: levelRules.experienceTitles?.[index] || analysis.targetRole,
      dates: levelRules.dateRanges?.[index] || "Dates",
      environment: progressiveSkillSlice(analysis.requiredSkills || [], index, levelRules),
      bullets: responsibilitiesToBullets(analysis, levelRules, index)
    });
  }
  return result;
}

function padProjects(projects, analysis, skills, expectedCount) {
  const result = [...(projects || [])].filter((project) => !/jd-aligned technical project/i.test(project?.name || ""));
  while (result.length < expectedCount) {
    result.push({
      name: `${analysis.domain || "Technical"} Platform Enhancement`,
      bullets: [
        `Built a ${analysis.targetRole} project using ${skills.slice(0, 4).join(", ") || "core JD technologies"}.`,
        "Delivered features aligned to the generated work experience and role responsibilities."
      ]
    });
  }
  return result;
}

function normalizeEnvironment(environment, skills, levelRules, index) {
  const progressionLimits = levelRules.environmentProgression?.maxItemsByEntry || [];
  const target = Number(progressionLimits[index] || firstNumber(levelRules.skills?.environmentItemsPerExperience) || 8);
  const existing = uniqueStrings(environment || []);
  const supplemental = progressiveSkillSlice(skills, index, levelRules, target);
  let result = uniqueStrings([...existing, ...supplemental]).slice(0, target);

  if (index > 0) {
    result = result.filter((item) => !/^(agile|scrum|kanban)$/i.test(String(item).trim()));
  }

  if (index >= 2) {
    result = result.filter((item) => !/microservices?/i.test(String(item)));
  }

  return result.slice(0, target);
}

function sanitizeSummary(summary, analysis) {
  let text = String(summary || "").trim();
  if (!text) return text;
  if (!analysis.allowsMetrics) {
    text = stripUnsupportedMetrics(text);
  }
  return text.replace(/\s+/g, " ").trim();
}

function sanitizeBullet(bullet, analysis) {
  let text = fixBrokenBullet(bullet);
  if (!analysis.allowsMetrics) {
    text = stripUnsupportedMetrics(text);
  }
  return text.replace(/\s+/g, " ").replace(/\s+\./g, ".").trim();
}

function stripUnsupportedMetrics(text) {
  return String(text || "")
    .replace(/,\s*(?:improving|reducing|increasing|decreasing|boosting|lowering|enhancing|maintaining)[^.]*?\sby\s+\d+(?:\.\d+)?%/gi, "")
    .replace(/,\s*maintaining\s+system\s+uptime\s+of\s+\d+(?:\.\d+)?%/gi, "")
    .replace(/\b(?:maintain(?:ed|ing)?)\s+system\s+uptime\s+of\s+\d+(?:\.\d+)?%/gi, "Maintained system uptime")
    .replace(/\b(?:improved|reduced|increased|decreased|lowered|boosted|enhanced|optimized)[^.]*?\sby\s+\d+(?:\.\d+)?%/gi, (match) => match.replace(/\sby\s+\d+(?:\.\d+)?%/i, ""))
    .replace(/\sby\s+\d+(?:\.\d+)?%/gi, "")
    .replace(/\b(?:of|to|at)\s+\d+(?:\.\d+)?%/gi, "")
    .replace(/\b\d+(?:\.\d+)?%\s+(?:uptime|improvement|reduction|faster|slower)\b/gi, "")
    .replace(/,\s*(?:which|resulting in|leading to)[^.]*?\d+(?:\.\d+)?%[^.]*\./gi, ".")
    .replace(/\b\d+(?:\.\d+)?%\s+test coverage\b/gi, "automated test coverage")
    .replace(/\bzero downtime\b/gi, "stable releases")
    .replace(/,\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeForCompare(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.replace(/(ing|ed|es)$/i, ""))
    .join(" ");
}

function isGenericJdBullet(bullet, analysis) {
  const text = normalizeForCompare(bullet);
  if (!text) return true;

  return (analysis.responsibilities || []).some((line) => {
    const responsibility = normalizeForCompare(line);
    if (responsibility.length < 35) return false;
    if (text === responsibility) return true;
    if (text.includes(responsibility)) return true;
    if (responsibility.includes(text) && text.length >= 35) return true;

    const responsibilityWords = new Set(
      responsibility.split(" ")
        .filter((word) => word.length > 3)
        .map((word) => word.replace(/(ing|ed|es)$/i, ""))
    );
    const bulletWords = text.split(" ")
      .filter((word) => word.length > 3)
      .map((word) => word.replace(/(ing|ed|es)$/i, ""));

    if (!bulletWords.length || !responsibilityWords.size) return false;

    const overlap = bulletWords.filter((word) => responsibilityWords.has(word)).length;
    return overlap / bulletWords.length >= 0.8;
  });
}

function bulletSignature(bullet) {
  return String(bullet || "")
    .toLowerCase()
    .replace(/^(designed|developed|implemented|optimized|integrated|automated|supported|improved|collaborated|built|maintained|led|partnered|expanded|hardened|refactored|documented|reviewed|authored|participated|updated|fixed|assisted|helped|learned|tuned|practiced|contributed|delivered|owned)\b\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNearDuplicateBullet(bullet, seenTexts, seenSignatures) {
  const key = String(bullet || "").toLowerCase();
  const signature = bulletSignature(bullet);
  if (seenTexts.has(key)) return true;
  if (signature.length >= 20 && seenSignatures.has(signature)) return true;
  return false;
}

function trackBullet(bullet, seenTexts, seenSignatures) {
  seenTexts.add(String(bullet || "").toLowerCase());
  const signature = bulletSignature(bullet);
  if (signature.length >= 20) seenSignatures.add(signature);
}

function fallbackExperienceBullets(analysis, levelRules, index) {
  const skills = analysis.requiredSkills || [];
  const primary = skills[0] || "Java";
  const framework = skills.find((skill) => /spring|react|node|django|flask|\.net/i.test(skill)) || "Spring Boot";
  const database = skills.find((skill) => /sql|postgres|oracle|mongo|mysql|redis/i.test(skill)) || "SQL";
  const domainLabel = analysis.domain && !/general technology/i.test(analysis.domain) ? analysis.domain : "core";
  const title = levelRules.experienceTitles?.[index] || analysis.targetRole;

  const pools = [
    [
      `Owned ${primary} microservices for ${domainLabel} workflows using ${framework}, REST APIs, and automated testing.`,
      `Partnered with product, QA, and operations teams to plan releases and resolve production issues in Agile sprints.`,
      `Containerized services with Docker and coordinated Kubernetes deployments for consistent release environments.`,
      `Expanded JUnit and Mockito coverage across service layers before production releases.`,
      `Hardened logging and monitoring to speed up incident triage and root-cause analysis.`,
      `Refactored legacy modules to improve maintainability while preserving ${domainLabel} domain requirements.`,
      `Documented API contracts and onboarding notes for downstream consumers and support teams.`,
      `Reviewed pull requests and shaped implementation decisions during feature delivery.`
    ],
    [
      `Built ${primary} REST endpoints for ${domainLabel} data exchange and third-party integrations.`,
      `Maintained service reliability by diagnosing defects and shipping fixes through scheduled releases.`,
      `Tuned ${database} queries and data access patterns to stabilize application performance.`,
      `Authored integration tests and Postman collections for regression validation before release.`,
      `Participated in sprint planning, backlog refinement, and technical design discussions.`,
      `Supported CI/CD pipelines and release checklists for staged deployments.`,
      `Updated API documentation and runbooks used by QA and support teams.`
    ],
    [
      `Implemented ${primary} modules for ${domainLabel} applications as a ${title} under senior engineer guidance.`,
      `Fixed assigned defects and verified changes with unit tests before QA handoff.`,
      `Assisted with API updates and smaller feature tickets in a cross-functional Agile team.`,
      `Applied code review feedback while working through Git feature branches and pull requests.`,
      `Reproduced customer issues and documented reproduction steps for faster root-cause analysis.`,
      `Contributed to shared ${framework} components while learning team coding standards and practices.`
    ]
  ];

  const bucket = pools[Math.min(index, pools.length - 1)];
  const offset = index * 2;
  return [...bucket.slice(offset % bucket.length), ...bucket.slice(0, offset % bucket.length)];
}

function getBulletBounds(levelRules, index) {
  const range = index === 0 ? levelRules.experienceBullets?.primary : levelRules.experienceBullets?.older;
  const { min, max } = parseCountRange(range);
  const targetMax = max || min || 6;
  const floor = Number(levelRules.minimumBulletsPerEntry ?? 5);
  const targetMin = Math.max(floor, min || targetMax);
  return { targetMin, targetMax };
}

function padBulletsToTarget(bullets, analysis, levelRules, index, seenTexts = new Set(), seenSignatures = new Set()) {
  const { targetMin, targetMax } = getBulletBounds(levelRules, index);
  let result = uniqueStrings(bullets || [])
    .map((bullet) => sanitizeBullet(bullet, analysis))
    .filter((bullet) => !isBadBullet(bullet, analysis))
    .filter((bullet) => {
      if (isNearDuplicateBullet(bullet, seenTexts, seenSignatures)) return false;
      trackBullet(bullet, seenTexts, seenSignatures);
      return true;
    });

  if (result.length < targetMin) {
    const extras = fallbackExperienceBullets(analysis, levelRules, index)
      .map((bullet) => sanitizeBullet(bullet, analysis))
      .filter((bullet) => !isBadBullet(bullet, analysis))
      .filter((bullet) => !isNearDuplicateBullet(bullet, seenTexts, seenSignatures))
      .filter((bullet) => !result.some((existing) => {
        const signature = bulletSignature(bullet);
        return signature.length >= 20 && signature === bulletSignature(existing);
      }));

    for (const bullet of extras) {
      if (result.length >= targetMin) break;
      trackBullet(bullet, seenTexts, seenSignatures);
      result.push(bullet);
    }
  }

  return result.slice(0, targetMax);
}

function ensureMinimumExperienceBullets(experiences, analysis, levelRules) {
  const seenTexts = new Set();
  const seenSignatures = new Set();
  return experiences.map((experience, index) => ({
    ...experience,
    bullets: padBulletsToTarget(experience.bullets, analysis, levelRules, index, seenTexts, seenSignatures)
  }));
}

function normalizeBullets(bullets, levelRules, index, analysis) {
  return padBulletsToTarget(bullets, analysis, levelRules, index);
}

function fixBrokenBullet(bullet) {
  return String(bullet || "")
    .replace(/^Designed collaborate\b/i, "Collaborated")
    .replace(/^Developed collaborate\b/i, "Collaborated")
    .replace(/^Implemented collaborate\b/i, "Collaborated")
    .replace(/^Designed solid experience with\b/i, "Applied")
    .replace(/^Designed define\b/i, "Defined")
    .replace(/^Designed develop\b/i, "Developed")
    .replace(/^Designed design\b/i, "Designed")
    .replace(/^Designed implement\b/i, "Implemented")
    .replace(/\b(jd stack|work experience domain|from the jd|job description)\b/gi, "production workflows")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeExperienceBullets(experiences) {
  const seenTexts = new Set();
  const seenSignatures = new Set();
  return experiences.map((experience) => ({
    ...experience,
    bullets: (experience.bullets || []).filter((bullet) => {
      if (isNearDuplicateBullet(bullet, seenTexts, seenSignatures)) return false;
      trackBullet(bullet, seenTexts, seenSignatures);
      return true;
    })
  }));
}

function isBadBullet(bullet, analysis = {}) {
  const text = String(bullet || "").toLowerCase();
  if (!text || text.length < 20) return true;

  return (
    text.includes("from the jd") ||
    text.includes("job description") ||
    text.includes("jd stack") ||
    text.includes("work experience domain") ||
    text.includes("micro1") ||
    text.includes("frontier ai") ||
    text.includes("talent platform") ||
    /^designed (solid|collaborate|define|develop|design)\b/.test(text) ||
    /\bfeatures for .+ workflows using .+, .+, .+\b/.test(text) ||
    /^(\w+ed) backend services, rest apis, and integrations with automated testing and production support\.?$/i.test(text) ||
    /^(\w+ed) cross-functional delivery through agile sprints, code reviews, and defect resolution\.?$/i.test(text) ||
    isGenericJdBullet(bullet, analysis) ||
    text.length > 220
  );
}

function normalizeProjectBullets(bullets, levelRules, analysis) {
  const target = firstNumber(levelRules.projectBullets) || 3;
  return (bullets || [])
    .map((bullet) => sanitizeBullet(bullet, analysis))
    .filter((bullet) => !isBadBullet(bullet, analysis))
    .slice(0, target);
}

function calculateExperienceYears(experiences) {
  const years = experiences.flatMap((experience) => String(experience.dates || "").match(/\b(19|20)\d{2}\b/g) || []).map(Number);
  if (!years.length) return 0;
  const earliest = Math.min(...years);
  const latest = Math.max(new Date().getFullYear(), ...years);
  return Math.max(0, latest - earliest);
}

function normalizeSummaryYears(summary, totalYears, levelRules) {
  if (!summary || !totalYears) return summary;
  const replacement = levelRules.totalYearsRange?.summaryClaim || `${totalYears}+ years of experience`;
  const patterns = [
    /\b\d+\+?\s+years?\s+of\s+experience\b/gi,
    /\bover\s+\d+\+?\s+years?\s+of\s+experience\b/gi,
    /\bmore\s+than\s+\d+\+?\s+years?\s+of\s+experience\b/gi,
    /\bover\s+\d+\+?\s+years?\b/gi,
    /\bmore\s+than\s+\d+\+?\s+years?\b/gi
  ];
  let normalized = summary;
  for (const pattern of patterns) {
    normalized = normalized.replace(pattern, replacement);
  }
  normalized = normalized.replace(/\b(\d+\+ years)(?!\s+of\s+experience)/i, "$1 of experience");
  if (normalized === summary && levelRules.totalYearsRange?.summaryClaim && !/internship|project/i.test(levelRules.totalYearsRange.summaryClaim) && !/\byears?\s+of\s+experience\b/i.test(summary)) {
    normalized = normalized.replace(/^([^.!?]+)([.!?])/, `$1 with ${replacement}$2`);
  }
  normalized = normalized.replace(/(\b\d+\+ years of experience\b)(?:(?!\.).)*\b\d+\+ years of experience\b/i, "$1");
  return normalized;
}

function clampExperienceYears(totalYears, levelRules) {
  const min = Number(levelRules.totalYearsRange?.min || 0);
  const max = Number(levelRules.totalYearsRange?.max || totalYears || 0);
  if (!totalYears) return max || min;
  return Math.max(min, Math.min(max, totalYears));
}

function getDateRangeForLevel(levelRules, index) {
  const ranges = normalizeDateRangesForYearBand(levelRules);
  return ranges[index] || levelRules.dateRanges?.[index] || "Dates";
}

function normalizeDateRangesForYearBand(levelRules) {
  const existingRanges = levelRules.dateRanges || [];
  const maxYears = Number(levelRules.totalYearsRange?.max || 0);
  const entryCount = Number(levelRules.experienceEntries || existingRanges.length || 1);
  const currentYear = new Date().getFullYear();

  if (!maxYears || existingRanges.some((range) => /summer|intern/i.test(String(range)))) return existingRanges;

  const earliestAllowed = currentYear - maxYears;
  const parsedEarliest = Math.min(...existingRanges.flatMap((range) => String(range).match(/\b(19|20)\d{2}\b/g) || []).map(Number));

  if (Number.isFinite(parsedEarliest) && parsedEarliest >= earliestAllowed) return existingRanges;

  const ranges = [];
  let end = currentYear;
  for (let index = 0; index < entryCount; index += 1) {
    const remainingEntries = entryCount - index;
    const remainingYears = Math.max(1, end - earliestAllowed);
    const span = Math.max(1, Math.ceil(remainingYears / remainingEntries));
    const start = Math.max(earliestAllowed, end - span);
    ranges.push(index === 0 ? `${start} - Present` : `${start} - ${end}`);
    end = start;
  }

  return ranges;
}

function normalizeSkillGroups(skillGroups, matchedSkills, levelRules) {
  const minGroups = firstNumber(levelRules.skills?.categoryCount) || 5;
  const perCategory = firstNumber(levelRules.skills?.itemsPerCategory) || 5;
  const banned = (levelRules.skills?.bannedSkillItems || []).map((item) => item.toLowerCase());
  const categoryNames = levelRules.skills?.categoryNames || [];
  const pool = filterSkillItems([
    ...matchedSkills,
    ...(levelRules.skills?.adjacentSkillExamples || [])
  ], banned);

  const groups = Array.isArray(skillGroups) ? skillGroups : [];
  const aiGroups = groups.map((group, index) => ({
    category: categoryNames[index] || group.category,
    items: filterSkillItems(group.items || [], banned)
  }));

  const categorized = categorizeSkills(pool, categoryNames.length ? categoryNames : aiGroups.map((g) => g.category));
  const merged = categoryNames.length
    ? categoryNames.slice(0, minGroups).map((category) => ({
      category,
      items: uniqueStrings(categorized.get(category) || []).slice(0, perCategory)
    }))
    : aiGroups.map((group) => ({
      category: group.category,
      items: uniqueStrings([
        ...(categorized.get(group.category) || []),
        ...group.items
      ]).slice(0, perCategory)
    }));

  const result = merged.filter((group) => group.items.length);
  while (result.length < minGroups) {
    const index = result.length;
    const category = categoryNames[index] || `Role Skill Group ${index + 1}`;
    const existing = new Set(result.flatMap((group) => group.items.map((item) => item.toLowerCase())));
    const items = (categorized.get(category) || distributeSkills(pool, index, perCategory, banned))
      .filter((item) => !existing.has(item.toLowerCase()));
    if (items.length) {
      result.push({ category, items: items.slice(0, perCategory) });
    } else {
      break;
    }
  }

  return result.filter((group) => group.items.length);
}

const skillCategoryPatterns = [
  ["Programming Languages", /\b(java|javascript|typescript|python|go|ruby|c\+\+|c#|kotlin|scala)\b/i],
  ["Backend Frameworks", /\b(spring boot|spring mvc|spring cloud|spring security|hibernate|jpa|django|flask|express|\.net)\b/i],
  ["APIs & Integration", /\b(restful apis?|rest|graphql|soap|openapi|swagger|microservices?|kafka|rabbitmq|oauth2|jwt)\b/i],
  ["Databases", /\b(postgresql|postgres|oracle|mysql|sql server|mongodb|redis|elasticsearch|sql)\b/i],
  ["Cloud & DevOps", /\b(aws|azure|gcp|docker|kubernetes|k8s|jenkins|ci\/cd|terraform|cloudformation|github actions)\b/i],
  ["Testing & Quality", /\b(junit|mockito|jest|selenium|cucumber|unit testing|integration testing)\b/i],
  ["Monitoring & Tools", /\b(splunk|prometheus|grafana|logging|monitoring|postman|git)\b/i],
  ["Methodologies", /\b(agile|scrum|kanban|devops)\b/i]
];

function categorizeSkills(skills, categoryNames) {
  const buckets = new Map(categoryNames.map((name) => [name, []]));
  const fallbackCategory = categoryNames[0] || "Skills";

  for (const skill of skills) {
    const normalized = skill.toLowerCase();
    const match = skillCategoryPatterns.find(([category, pattern]) => {
      if (!categoryNames.length || categoryNames.includes(category)) {
        return pattern.test(normalized);
      }
      return false;
    });
    const category = match?.[0] || fallbackCategory;
    if (!buckets.has(category)) buckets.set(category, []);
    buckets.get(category).push(skill);
  }

  for (const [category, items] of buckets.entries()) {
    buckets.set(category, uniqueStrings(items));
  }

  return buckets;
}

function distributeSkills(skills, categoryIndex, perCategory, banned) {
  const filtered = filterSkillItems(skills, banned);
  const offset = categoryIndex * perCategory;
  return filtered.slice(offset, offset + perCategory);
}

function filterSkillItems(items, banned) {
  return uniqueStrings(items).filter((item) => {
    const normalized = item.toLowerCase();
    return !banned.some((blocked) => normalized.includes(blocked));
  });
}
