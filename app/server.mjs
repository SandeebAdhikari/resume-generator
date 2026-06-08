import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resumeJsonSchema } from "./core/resume-schema.js";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

await loadDotEnv();

const port = Number(process.env.PORT || 8787);
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "POST" && url.pathname === "/api/generate-resume") {
      await handleGenerateResume(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/revise-resume") {
      await handleReviseResume(request, response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    await serveStatic(url.pathname, response, request.method === "HEAD");
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Server error." });
  }
}).listen(port, () => {
  console.log(`Resume Tailor running at http://127.0.0.1:${port}`);
});

async function handleGenerateResume(request, response) {
  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 500, {
      error: "OPENAI_API_KEY is not set. Add it to app/.env or start the server with OPENAI_API_KEY=your_key npm start."
    });
    return;
  }

  const body = await readRequestJson(request);
  const { jobDescription, analysis, blueprint, generationRules } = body;

  if (!jobDescription || !analysis || !blueprint || !generationRules) {
    sendJson(response, 400, { error: "Missing jobDescription, analysis, blueprint, or generationRules." });
    return;
  }

  const resume = await callOpenAi({ jobDescription, analysis, blueprint, generationRules });
  sendJson(response, 200, { resume });
}

async function handleReviseResume(request, response) {
  const body = await readRequestJson(request);
  const { resume, jobDescription = "", analysis, blueprint, generationRules, instruction } = body;

  if (!resume || !analysis || !blueprint || !generationRules || !instruction) {
    sendJson(response, 400, { error: "Missing resume, analysis, blueprint, generationRules, or instruction." });
    return;
  }

  const section = classifyRevisionSection(instruction);

  if (section === "header") {
    sendJson(response, 200, reviseHeaderSection(resume, instruction, analysis));
    return;
  }

  if (section === "education") {
    sendJson(response, 200, reviseEducationSection(resume, instruction));
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 500, {
      error: "OPENAI_API_KEY is not set. Add it to app/.env or start the server with OPENAI_API_KEY=your_key npm start."
    });
    return;
  }

  const revisedResume = await callOpenAiRevision({
    resume,
    jobDescription,
    analysis,
    blueprint,
    generationRules,
    instruction,
    section
  });

  sendJson(response, 200, { status: "updated", section, resume: revisedResume });
}

async function callOpenAi({ jobDescription, analysis, blueprint, generationRules }) {
  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You generate ideal-candidate benchmark resumes.",
                "Depend only on the provided job description and job analysis for resume content.",
                "Use the layout blueprint only for structure, section order, density, formatting intent, and writing style.",
                "Do not use candidate-profile data. Do not copy reference-resume content. Do not mention that this is hypothetical.",
                "Set meta.mode to exactly ideal and meta.generatedBy to exactly ai.",
                "You may suggest real, well-known company names for ideal benchmark work experience when the JD does not provide company history. Choose companies that fit the JD domain, role, and seniority.",
                "Do not invent universities, certifications, metrics, percentages, or tools that are not present in the JD or normal adjacent skills from generation rules.",
                "Do not add technologies, platforms, architecture components, domains, or business contexts that are absent from the JD or job analysis.",
                "Use the generation rules to determine exact experience count, project count, bullet count, skill breadth, environment breadth, date placeholders, and level-appropriate writing.",
                "Any years-of-experience claim in the summary must match the generated work experience date ranges.",
                "Projects must align with generated work experience, company/domain context, and JD responsibilities. Do not create generic unrelated projects.",
                "Generate a different environment line for each work experience entry according to the environment progression rules.",
                "Use generation-rule date ranges. Treat target job location separately from prior experience locations.",
                "Do not leave project, skills, or experience sections empty unless the level rules explicitly allow zero items.",
                "Return only JSON matching the schema."
              ].join(" ")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                task: "Generate the best ideal-candidate resume for this JD.",
                jobDescription,
                jobAnalysis: analysis,
                layoutBlueprint: blueprint,
                generationRules,
                contentRules: {
                  contentSource: "job_description_only",
                  useLayoutBlueprintAs: "layout_and_writing_style_only",
                  useGenerationRulesForDepthAndCounts: true,
                  doNotUseExternalResumeContent: true,
                  generatePolishedResumeContent: true,
                  keepHeaderGeneric: true,
                  headerName: "Ideal Candidate",
                  requiredCounts: {
                    experienceEntries: generationRules.levelRules?.experienceEntries,
                    projectCount: generationRules.levelRules?.projectCount,
                    experienceBullets: generationRules.levelRules?.experienceBullets,
                    projectBullets: generationRules.levelRules?.projectBullets,
                    skillCategories: generationRules.levelRules?.skills?.categoryCount,
                    environmentItemsPerExperience: generationRules.levelRules?.skills?.environmentItemsPerExperience
                  },
                  consistencyRules: {
                    yearsConsistency: generationRules.globalRules?.yearsConsistency,
                    projectAlignment: generationRules.globalRules?.projectAlignment,
                    projectPolicy: generationRules.levelRules?.projectPolicy,
                    dateRanges: generationRules.levelRules?.dateRanges,
                    totalYearsRange: generationRules.levelRules?.totalYearsRange,
                    environmentProgression: generationRules.levelRules?.environmentProgression
                  },
                  skillRules: {
                    categoryNames: generationRules.levelRules?.skills?.categoryNames,
                    itemsPerCategory: generationRules.levelRules?.skills?.itemsPerCategory,
                    allowAcademicFoundations: generationRules.levelRules?.skills?.allowAcademicFoundations,
                    bannedSkillItems: generationRules.levelRules?.skills?.bannedSkillItems,
                    adjacentSkillExamples: generationRules.levelRules?.skills?.adjacentSkillExamples
                  },
                  companyNameMode: generationRules.globalRules?.companyNameMode || "ai_suggested_real_companies"
                }
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ideal_resume",
          strict: true,
          schema: resumeJsonSchema
        }
      }
    })
  });

  const payload = await apiResponse.json();

  if (!apiResponse.ok) {
    throw new Error(payload.error?.message || "OpenAI API request failed.");
  }

  const text = payload.output_text || extractOutputText(payload);
  if (!text) throw new Error("OpenAI response did not include resume JSON.");

  return normalizeAiResume(JSON.parse(text), analysis, blueprint, generationRules);
}

async function callOpenAiRevision({ resume, jobDescription, analysis, blueprint, generationRules, instruction, section }) {
  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You revise an existing resume JSON for an ideal-candidate benchmark app.",
                "Return the complete updated resume JSON, not only the changed section.",
                "Only change the requested section unless another section must change for strict consistency.",
                "Never change header or education; those are factual sections handled outside AI.",
                "Do not add fake personal education, personal contact data, unsupported certifications, or unsupported metrics.",
                "Keep company names, titles, locations, and dates unchanged unless the user explicitly asked to change them.",
                "For work experience changes, map ordinal language carefully: first means index 0, second means index 1, third means index 2.",
                "If the user asks for more skills in an experience, revise the environment line and bullets for that specific experience only.",
                "Follow the JD, job analysis, layout blueprint, level generation rules, year consistency rules, project alignment rules, and level-appropriate skill rules.",
                "Return only JSON matching the schema."
              ].join(" ")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                task: "Revise the requested resume section.",
                requestedSection: section,
                userInstruction: instruction,
                currentResume: resume,
                jobDescription,
                jobAnalysis: analysis,
                layoutBlueprint: blueprint,
                generationRules,
                sectionPayloadRules: revisionPayloadRules(section, generationRules)
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "revised_ideal_resume",
          strict: true,
          schema: resumeJsonSchema
        }
      }
    })
  });

  const payload = await apiResponse.json();

  if (!apiResponse.ok) {
    throw new Error(payload.error?.message || "OpenAI API revision request failed.");
  }

  const text = payload.output_text || extractOutputText(payload);
  if (!text) throw new Error("OpenAI response did not include revised resume JSON.");

  return normalizeAiResume(JSON.parse(text), analysis, blueprint, generationRules, {
    preserveHeader: resume.header,
    preserveEducation: resume.sections?.education
  });
}

function normalizeAiResume(resume, analysis, blueprint, generationRules, options = {}) {
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
    company: normalizeCompanyName(experience.company, analysis, index),
    location: normalizeExperienceLocation(experience.location, analysis, index),
    dates: getDateRangeForLevel(levelRules, index),
    title: experience.title || levelRules.experienceTitles?.[index] || analysis.targetRole,
    environment: normalizeEnvironment(experience.environment, resume.meta.matchedSkills, levelRules, index),
    bullets: normalizeBullets(experience.bullets, levelRules, index)
  }));

  const totalYears = clampExperienceYears(calculateExperienceYears(resume.sections.workExperience), levelRules);
  resume.sections.professionalSummary = normalizeSummaryYears(resume.sections.professionalSummary, totalYears, levelRules);

  if (options.preserveEducation) {
    resume.sections.education = options.preserveEducation;
  }

  resume.sections.projects = padProjects(resume.sections.projects, analysis, resume.meta.matchedSkills, levelRules, expectedProjectCount)
    .slice(0, expectedProjectCount)
    .map((project) => ({
      ...project,
      bullets: normalizeProjectBullets(project.bullets, levelRules)
    }));

  resume.sections.skills = normalizeSkillGroups(resume.sections.skills, resume.meta.matchedSkills, levelRules);

  return resume;
}

function classifyRevisionSection(instruction) {
  const text = String(instruction || "").toLowerCase();

  if (/\b(header|contact|phone|email|linkedin|portfolio|name)\b/.test(text)) return "header";
  if (/\b(education|school|university|college|degree|gpa|coursework|certification|certifications)\b/.test(text)) return "education";
  if (/\b(project|projects)\b/.test(text)) return "projects";
  if (/\b(experience|job|company|role|bullet|bullets|environment|first|second|third|current|previous)\b/.test(text)) return "workExperience";
  if (/\b(skill|skills|tools|technologies|tech stack|stack)\b/.test(text)) return "skills";
  if (/\b(summary|professional summary|profile)\b/.test(text)) return "professionalSummary";

  return "general";
}

function reviseHeaderSection(resume, instruction, analysis) {
  const parsed = parseHeaderFields(instruction);

  if (!Object.keys(parsed).length) {
    return {
      status: "needs_input",
      section: "header",
      missingFields: ["name", "phone", "email", "location", "portfolio", "linkedin"],
      message: "Tell me the header values to update, such as name, phone, email, location, portfolio, and LinkedIn."
    };
  }

  const nextResume = structuredClone(resume);
  nextResume.header = {
    ...nextResume.header,
    ...parsed,
    targetRole: parsed.targetRole || nextResume.header?.targetRole || analysis.targetRole
  };

  const missingFields = missingHeaderFields(nextResume.header);
  if (wantsCompleteSection(instruction) && missingFields.length) {
    return {
      status: "needs_input",
      section: "header",
      missingFields,
      message: "I can fill the header directly, but these header fields are still missing."
    };
  }

  return { status: "updated", section: "header", resume: nextResume };
}

function reviseEducationSection(resume, instruction) {
  const parsed = parseEducationFields(instruction);

  if (!parsed.education) {
    return {
      status: "needs_input",
      section: "education",
      missingFields: ["school", "degree"],
      message: "Tell me the school and degree to write the education section."
    };
  }

  const missingFields = [];
  if (wantsCompleteSection(instruction) && !parsed.fromEducationLine) {
    if (!parsed.school) missingFields.push("school");
    if (!parsed.degree) missingFields.push("degree");
  }

  if (missingFields.length) {
    return {
      status: "needs_input",
      section: "education",
      missingFields,
      message: "I can fill the education section directly, but these education fields are still missing."
    };
  }

  const nextResume = structuredClone(resume);
  nextResume.sections.education = parsed.education;
  return { status: "updated", section: "education", resume: nextResume };
}

function parseHeaderFields(instruction) {
  const fields = parseKeyValueFields(instruction);
  const parsed = {};
  const aliases = {
    name: "name",
    "full name": "name",
    role: "targetRole",
    title: "targetRole",
    "target role": "targetRole",
    location: "location",
    phone: "phone",
    email: "email",
    portfolio: "portfolio",
    website: "portfolio",
    linkedin: "linkedin",
    "linked in": "linkedin"
  };

  for (const [key, value] of Object.entries(fields)) {
    const target = aliases[key.toLowerCase()];
    if (target && value) parsed[target] = value;
  }

  const raw = String(instruction || "");
  const keyAlternation = "name|full name|role|title|target role|location|phone|email|portfolio|website|linkedin|linked in";
  const inlineFieldPattern = new RegExp(`\\b(${keyAlternation})\\s*[:=-]\\s*(.*?)(?=,\\s*(?:${keyAlternation})\\s*[:=-]|;|\\n|$)`, "gi");
  for (const match of raw.matchAll(inlineFieldPattern)) {
    const target = aliases[match[1].trim().toLowerCase()];
    const value = match[2].trim().replace(/,$/, "");
    if (target && value) parsed[target] = value;
  }

  const email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = raw.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0];
  const linkedin = raw.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s,]+/i)?.[0];
  const urls = raw.match(/https?:\/\/[^\s,]+/gi) || [];
  const portfolio = urls.find((url) => !/linkedin\.com/i.test(url));
  const name = raw.match(/\bmy name is\s+([^,.]+)/i)?.[1]?.trim();

  if (email && !parsed.email) parsed.email = email;
  if (phone && !parsed.phone) parsed.phone = phone;
  if (linkedin && !parsed.linkedin) parsed.linkedin = linkedin;
  if (portfolio && !parsed.portfolio) parsed.portfolio = portfolio;
  if (name && !parsed.name) parsed.name = name;

  return parsed;
}

function parseEducationFields(instruction) {
  const fields = parseKeyValueFields(instruction);
  const keyAlternation = "education|school|university|college|degree|major|location|graduation|graduation date|year|gpa|coursework|certification|certifications";
  const inlineFieldPattern = new RegExp(`\\b(${keyAlternation})\\s*[:=-]\\s*(.*?)(?=,\\s*(?:${keyAlternation})\\s*[:=-]|;|\\n|$)`, "gi");

  for (const match of String(instruction || "").matchAll(inlineFieldPattern)) {
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim().replace(/,$/, "");
    if (key && value) fields[key] = value;
  }

  const school = fields.school || fields.university || fields.college || "";
  const degree = fields.degree || "";
  const major = fields.major || "";
  const location = fields.location || "";
  const graduation = fields.graduation || fields["graduation date"] || fields.year || "";
  const gpa = fields.gpa || "";
  const coursework = fields.coursework || "";
  const certifications = fields.certifications || fields.certification || "";

  if (fields.education) {
    return { education: fields.education, school, degree, fromEducationLine: true };
  }

  const parts = [
    school,
    [degree, major].filter(Boolean).join(", "),
    location,
    graduation
  ].filter(Boolean);
  const details = [
    gpa ? `GPA: ${gpa}` : "",
    coursework ? `Coursework: ${coursework}` : "",
    certifications ? `Certifications: ${certifications}` : ""
  ].filter(Boolean);

  return {
    school,
    degree,
    fromEducationLine: false,
    education: [...parts, ...details].join(" | ")
  };
}

function parseKeyValueFields(instruction) {
  const fields = {};
  const lines = String(instruction || "").split(/\r?\n|;/);

  for (const line of lines) {
    const match = line.match(/^\s*([a-z][a-z\s]+?)\s*[:=-]\s*(.+?)\s*$/i);
    if (!match) continue;
    fields[match[1].trim().toLowerCase()] = match[2].trim();
  }

  return fields;
}

function missingHeaderFields(header) {
  const genericPatterns = {
    name: /^(ideal candidate|candidate|name)$/i,
    phone: /^(\(?555\)?[\s.-]?555[\s.-]?5555|phone)$/i,
    email: /^(ideal\.candidate@example\.com|email)$/i,
    location: /^(location|remote)$/i,
    portfolio: /^(https?:\/\/)?(idealcandidate\.dev|portfolio)$/i,
    linkedin: /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/idealcandidate\/?$/i
  };

  return ["name", "phone", "email", "location", "portfolio", "linkedin"].filter((field) => {
    const value = String(header?.[field] || "").trim();
    return !value || genericPatterns[field].test(value);
  });
}

function wantsCompleteSection(instruction) {
  return /\b(fill|complete|full|all|my info|my information|profile|header|education)\b/i.test(String(instruction || ""));
}

function revisionPayloadRules(section, generationRules) {
  const levelRules = generationRules.levelRules || {};
  const globalRules = generationRules.globalRules || {};
  const shared = {
    section,
    sourceOfTruth: "current resume JSON plus JD and level rules",
    preserveUnrequestedSections: true,
    preserveHeaderAndEducation: true,
    yearsConsistency: globalRules.yearsConsistency,
    dateRanges: levelRules.dateRanges,
    totalYearsRange: levelRules.totalYearsRange
  };

  const sectionRules = {
    professionalSummary: {
      send: ["current professionalSummary", "JD analysis", "matched skills", "experience dates"],
      updateOnly: "sections.professionalSummary",
      constraints: [
        "Make the summary match generated work experience years.",
        "Do not add skills, domains, or certifications unsupported by the JD/rules.",
        "Keep it level-appropriate and resume-ready."
      ]
    },
    skills: {
      send: ["current skills", "JD skills", "level skill rules", "banned skill items"],
      updateOnly: "sections.skills",
      constraints: [
        "Use level-appropriate categories from the rules.",
        "Do not include academic/basic items when banned for the level.",
        "Include enough adjacent environment tools for the role without inventing unrelated stacks."
      ]
    },
    workExperience: {
      send: ["current workExperience", "JD responsibilities", "level experience rules", "environment progression rules"],
      updateOnly: "sections.workExperience",
      constraints: [
        "If the request names first/second/third experience, revise only that entry.",
        "Keep company, location, title, and dates unless explicitly asked.",
        "Environment must match that specific experience's role seniority and technology context.",
        "Bullets should describe realistic work done at that company/domain and align with JD responsibilities."
      ]
    },
    projects: {
      send: ["current projects", "workExperience", "JD domain", "project alignment rules"],
      updateOnly: "sections.projects",
      constraints: [
        "Projects must align to the generated work experience and JD domain.",
        "Do not create isolated generic projects unrelated to the company/domain context.",
        "Follow project count and bullet count rules."
      ]
    },
    general: {
      send: ["full current resume", "JD", "analysis", "blueprint", "generation rules"],
      updateOnly: "the sections directly implied by the user request",
      constraints: [
        "Preserve header and education.",
        "Preserve unrequested sections.",
        "Maintain level rules and consistency rules."
      ]
    }
  };

  return {
    ...shared,
    ...(sectionRules[section] || sectionRules.general)
  };
}

function companyPlaceholder(index) {
  if (index === 0) return "Company from JD";
  if (index === 1) return "Prior relevant organization";
  return "Earlier relevant organization";
}

function normalizeCompanyName(company, analysis, index) {
  const value = String(company || "").split(/\s+\|\s+/)[0].trim();
  if (!value || /company from jd|prior relevant|earlier relevant|confidential/i.test(value)) {
    return companyPlaceholder(index);
  }
  return value;
}

function normalizeExperienceLocation(location, analysis, index) {
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
      environment: analysis.requiredSkills || [],
      bullets: [`Performed ${analysis.targetRole} responsibilities aligned with the job description.`]
    });
  }
  return result;
}

function padProjects(projects, analysis, skills, levelRules, expectedCount) {
  const result = [...(projects || [])];
  while (result.length < expectedCount) {
    result.push({
      name: "JD-Aligned Technical Project",
      bullets: [
        `Built a project aligned with ${analysis.targetRole} responsibilities from the JD.`,
        skills.length ? `Used ${skills.slice(0, 6).join(", ")} in a role-appropriate implementation context.` : "Used the core technologies described in the JD."
      ]
    });
  }
  return result;
}

function normalizeEnvironment(environment, skills, levelRules, index) {
  const progressionLimits = levelRules.environmentProgression?.maxItemsByEntry || [];
  const target = Number(progressionLimits[index] || firstNumber(levelRules.skills?.environmentItemsPerExperience) || 8);
  const merged = uniqueStrings([...(environment || []), ...skills]);
  return merged.slice(0, target);
}

function normalizeBullets(bullets, levelRules, index) {
  const range = index === 0 ? levelRules.experienceBullets?.primary : levelRules.experienceBullets?.older;
  const target = firstNumber(range) || 5;
  return (bullets || []).slice(0, target);
}

function normalizeProjectBullets(bullets, levelRules) {
  const target = firstNumber(levelRules.projectBullets) || 3;
  return (bullets || []).slice(0, target);
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
  const groups = Array.isArray(skillGroups) ? skillGroups : [];
  const minGroups = firstNumber(levelRules.skills?.categoryCount) || 5;
  const banned = (levelRules.skills?.bannedSkillItems || []).map((item) => item.toLowerCase());
  const categoryNames = levelRules.skills?.categoryNames || [];
  const result = groups.map((group, index) => ({
    category: categoryNames[index] || group.category,
    items: filterSkillItems(group.items || [], banned)
  })).filter((group) => group.items.length);

  if (!result.length) {
    result.push({ category: "JD Skills", items: matchedSkills });
  }

  while (result.length < minGroups) {
    const category = categoryNames[result.length] || `Role Skill Group ${result.length + 1}`;
    result.push({
      category,
      items: filterSkillItems(matchedSkills.slice(0, firstNumber(levelRules.skills?.itemsPerCategory) || 5), banned)
    });
  }

  return result;
}

function filterSkillItems(items, banned) {
  return uniqueStrings(items).filter((item) => {
    const normalized = item.toLowerCase();
    return !banned.some((blocked) => normalized.includes(blocked));
  });
}

function firstNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function uniqueStrings(items) {
  return [...new Set(items.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))];
}


function extractOutputText(payload) {
  return payload.output
    ?.flatMap((item) => item.content || [])
    ?.filter((content) => content.type === "output_text")
    ?.map((content) => content.text)
    ?.join("");
}

async function serveStatic(pathname, response, headOnly) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const resolvedPath = resolve(rootDir, safePath === "/" ? "index.html" : safePath.slice(1));

  if (!resolvedPath.startsWith(resolve(rootDir))) {
    sendJson(response, 403, { error: "Forbidden." });
    return;
  }

  const body = await readFile(resolvedPath);
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(resolvedPath)] || "application/octet-stream"
  });
  if (!headOnly) response.end(body);
  else response.end();
}

async function readRequestJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_500_000) throw new Error("Request body too large.");
  }
  return JSON.parse(body || "{}");
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function loadDotEnv() {
  try {
    const envText = await readFile(resolve(rootDir, ".env"), "utf8");
    for (const rawLine of envText.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
