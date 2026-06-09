function isOllama(provider) {
  return provider !== "openai";
}

function buildLevelChecklist(analysis, generationRules) {
  const levelRules = generationRules.levelRules || {};
  const skills = levelRules.skills || {};

  return {
    detectedLevel: analysis.level,
    targetRole: analysis.targetRole,
    targetCompany: analysis.companyName || "",
    targetLocation: analysis.location || "",
    domain: analysis.domain || "",
    requiredSkills: analysis.requiredSkills || [],
    preferredSkills: analysis.preferredSkills || [],
    responsibilities: analysis.responsibilities || [],
    experienceEntries: levelRules.experienceEntries,
    experienceTitles: levelRules.experienceTitles || [],
    projectCount: levelRules.projectCount,
    dateRanges: levelRules.dateRanges || [],
    summaryClaim: levelRules.totalYearsRange?.summaryClaim || "",
    totalYearsMin: levelRules.totalYearsRange?.min,
    totalYearsMax: levelRules.totalYearsRange?.max,
    experienceBulletsPrimary: levelRules.experienceBullets?.primary,
    experienceBulletsOlder: levelRules.experienceBullets?.older,
    minimumBulletsPerEntry: levelRules.minimumBulletsPerEntry,
    projectBullets: levelRules.projectBullets,
    skillCategoryCount: skills.categoryCount,
    skillCategoryNames: skills.categoryNames || [],
    itemsPerSkillCategory: skills.itemsPerCategory,
    environmentItemsPerExperience: skills.environmentItemsPerExperience,
    bannedSkillItems: skills.bannedSkillItems || [],
    adjacentSkillExamples: skills.adjacentSkillExamples || [],
    writingTone: levelRules.writingStyle?.tone || "",
    preferredVerbs: levelRules.writingStyle?.verbs || [],
    avoidVerbs: levelRules.writingStyle?.avoid || [],
    projectPolicy: levelRules.projectPolicy || "",
    environmentProgression: levelRules.environmentProgression || {}
  };
}

function extractWritingBrief(blueprint, generationRules) {
  const sections = blueprint?.sections || {};
  const levelRules = generationRules?.levelRules || {};
  const bulletWriting = sections.workExperience?.bulletWriting || {};

  return {
    layoutLevel: blueprint?.level || levelRules.level || "",
    sectionOrder: blueprint?.sectionOrder || [],
    aiInstructions: blueprint?.aiInstructions || {},
    summary: {
      targetLength: sections.summary?.targetLength || levelRules.summaryLines || "",
      writingStyle: sections.summary?.writingStyle || "",
      include: sections.summary?.include || [],
      avoid: sections.summary?.avoid || []
    },
    skills: {
      format: sections.skills?.format || "",
      categories: sections.skills?.categories || levelRules.skills?.categoryNames || [],
      writingStyle: sections.skills?.writingStyle || ""
    },
    workExperience: {
      bulletCount: sections.workExperience?.bulletCount || "",
      bulletWriting: {
        tone: bulletWriting.tone || levelRules.writingStyle?.tone || "",
        verbs: bulletWriting.verbs || levelRules.writingStyle?.verbs || [],
        pattern: bulletWriting.pattern || "Action verb + owned work + technology + concrete outcome",
        avoid: bulletWriting.avoid || levelRules.writingStyle?.avoid || []
      },
      environmentLine: sections.workExperience?.environmentLine || {}
    },
    projects: {
      writingStyle: sections.projects?.writingStyle || levelRules.projectPolicy || "",
      bulletCount: sections.projects?.bulletCount || levelRules.projectBullets || ""
    }
  };
}

function resumeOutputShapeHint(checklist) {
  return {
    meta: {
      mode: "ideal",
      level: checklist.detectedLevel,
      layout: checklist.detectedLevel,
      targetRole: checklist.targetRole,
      companyName: checklist.targetCompany,
      location: checklist.targetLocation,
      domain: checklist.domain,
      matchedSkills: [...checklist.requiredSkills, ...checklist.preferredSkills].slice(0, 12),
      generatedBy: "ai"
    },
    header: {
      name: "Ideal Candidate",
      targetRole: checklist.targetRole,
      location: "Location",
      phone: "(555) 555-5555",
      email: "ideal.candidate@example.com",
      portfolio: "https://idealcandidate.dev",
      linkedin: "https://linkedin.com/in/idealcandidate"
    },
    sections: {
      professionalSummary: `Polished ${checklist.summaryClaim || "level-appropriate"} summary using JD skills and responsibilities.`,
      skills: (checklist.skillCategoryNames.length ? checklist.skillCategoryNames : ["Languages", "Backend", "Databases"]).slice(0, 3).map((category, index) => ({
        category,
        items: index === 0
          ? checklist.requiredSkills.filter((s) => /^(Java|JavaScript|TypeScript|Python)$/i.test(s)).slice(0, 3)
          : index === 1
            ? checklist.requiredSkills.filter((s) => /spring|boot|mvc|hibernate/i.test(s)).slice(0, 3)
            : checklist.requiredSkills.filter((s) => /sql|postgres|oracle|mongo|redis/i.test(s)).slice(0, 3)
      })).map((group) => ({ ...group, items: group.items.length ? group.items : checklist.requiredSkills.slice(0, 3) })),
      workExperience: [
        {
          company: "Cerner",
          location: "Kansas City, MO",
          title: checklist.experienceTitles[0] || checklist.targetRole,
          dates: checklist.dateRanges[0] || "2020 - Present",
          environment: checklist.requiredSkills.slice(0, 6),
          bullets: [
            "Implemented Java microservices for claims processing workflows using Spring Boot and REST APIs.",
            "Collaborated with QA and product teams to deliver features through Agile sprints."
          ]
        },
        {
          company: "Optum",
          location: "Minneapolis, MN",
          title: checklist.experienceTitles[1] || "Software Developer",
          dates: checklist.dateRanges[1] || "2018 - 2020",
          environment: checklist.requiredSkills.slice(0, 4),
          bullets: [
            "Developed Java services and REST endpoints for healthcare data exchange.",
            "Supported production releases and resolved defects in a cross-functional Agile team."
          ]
        }
      ],
      projects: checklist.projectCount > 0 ? [{
        name: "Healthcare Claims Processing Service",
        bullets: ["Built a Spring Boot microservice for claims intake, validation, and status tracking."]
      }] : [],
      education: ""
    }
  };
}

function formatList(items, prefix = "- ") {
  return (items || []).map((item) => `${prefix}${item}`).join("\n");
}

function levelRulesWritingStyle(generationRules) {
  const style = generationRules.levelRules?.writingStyle;
  if (!style) return "";
  const parts = [
    style.tone ? `Level writing tone: ${style.tone}` : "",
    style.verbs?.length ? `Level verbs: ${style.verbs.join(", ")}` : "",
    style.avoid?.length ? `Level avoid: ${style.avoid.join(", ")}` : ""
  ].filter(Boolean);
  return parts.length ? parts.map((part) => `- ${part}`).join("\n") : "";
}

function buildOllamaGenerationUserPrompt({ jobDescription, analysis, blueprint, generationRules }) {
  const checklist = buildLevelChecklist(analysis, generationRules);
  const writingBrief = extractWritingBrief(blueprint, generationRules);
  const responsibilities = checklist.responsibilities.length
    ? checklist.responsibilities
    : [`Deliver ${checklist.targetRole} responsibilities described in the job description.`];

  return [
    "TASK: Generate the best ideal-candidate resume for the job below.",
    "Write polished, human-quality resume content. Do not produce generic template filler.",
    "",
    "ROLE CONTEXT",
    `Target role: ${checklist.targetRole}`,
    `Detected level: ${checklist.detectedLevel}`,
    `Domain: ${checklist.domain}`,
    checklist.targetCompany ? `Target employer in JD: ${checklist.targetCompany} (this is the job being applied to, not necessarily a past employer)` : "Target employer: not named in JD",
    checklist.targetLocation ? `Target location: ${checklist.targetLocation}` : "",
    "",
    "REQUIRED COUNTS — follow exactly",
    `- Work experience entries: ${checklist.experienceEntries}`,
    `- Project entries: ${checklist.projectCount}`,
    `- Primary role bullets: ${checklist.experienceBulletsPrimary}`,
    `- Older role bullets: ${checklist.experienceBulletsOlder}`,
    checklist.minimumBulletsPerEntry ? `- Minimum bullets for every work experience entry: ${checklist.minimumBulletsPerEntry}` : "",
    `- Project bullets per project: ${checklist.projectBullets}`,
    `- Skill categories: ${checklist.skillCategoryCount}`,
    `- Items per skill category: ${checklist.itemsPerSkillCategory}`,
    `- Experience titles in order: ${checklist.experienceTitles.join(" | ") || checklist.targetRole}`,
    `- Date ranges in order: ${checklist.dateRanges.join(" | ") || "use level-appropriate ranges"}`,
    `- Summary must reflect: ${checklist.summaryClaim || "level-appropriate experience"}`,
    "",
    "JD SKILLS — use heavily in summary, skills, environment, and bullets",
    formatList(checklist.requiredSkills, "- required: "),
    checklist.preferredSkills.length ? formatList(checklist.preferredSkills, "- preferred: ") : "",
    checklist.adjacentSkillExamples.length ? `Adjacent skills allowed when normal for the role: ${checklist.adjacentSkillExamples.join(", ")}` : "",
    checklist.bannedSkillItems.length ? `Do not include: ${checklist.bannedSkillItems.join(", ")}` : "",
    "",
    "JD RESPONSIBILITIES — rewrite these into strong resume bullets",
    formatList(responsibilities, "1. "),
    "",
    "WRITING STYLE",
    `Tone: ${writingBrief.workExperience.bulletWriting.tone || checklist.writingTone || "professional and specific"}`,
    `Bullet pattern: ${writingBrief.workExperience.bulletWriting.pattern}`,
    `Use verbs like: ${(writingBrief.workExperience.bulletWriting.verbs || checklist.preferredVerbs).join(", ")}`,
    (writingBrief.workExperience.bulletWriting.avoid || checklist.avoidVerbs).length
      ? `Avoid: ${(writingBrief.workExperience.bulletWriting.avoid || checklist.avoidVerbs).join(", ")}`
      : "",
    writingBrief.summary.writingStyle ? `Summary style: ${writingBrief.summary.writingStyle}` : "",
    writingBrief.summary.include.length ? `Summary must include: ${writingBrief.summary.include.join(", ")}` : "",
    writingBrief.skills.writingStyle ? `Skills style: ${writingBrief.skills.writingStyle}` : "",
    writingBrief.projects.writingStyle ? `Projects style: ${writingBrief.projects.writingStyle}` : "",
    checklist.projectPolicy ? `Project policy: ${checklist.projectPolicy}` : "",
    "",
    "LAYOUT AI INSTRUCTIONS — follow these over generic resume habits",
    writingBrief.aiInstructions.layoutPriority ? `- ${writingBrief.aiInstructions.layoutPriority}` : "",
    writingBrief.aiInstructions.contentGeneration ? `- ${writingBrief.aiInstructions.contentGeneration}` : "",
    writingBrief.aiInstructions.jdTailoring ? `- ${writingBrief.aiInstructions.jdTailoring}` : "",
    writingBrief.aiInstructions.outputRequirement ? `- ${writingBrief.aiInstructions.outputRequirement}` : "",
    "",
    "GLOBAL GENERATION RULES",
    generationRules.globalRules?.contentSource ? `- ${generationRules.globalRules.contentSource}` : "",
    generationRules.globalRules?.adjacentSkills ? `- ${generationRules.globalRules.adjacentSkills}` : "",
    generationRules.globalRules?.companyNames ? `- ${generationRules.globalRules.companyNames}` : "",
    generationRules.globalRules?.yearsConsistency ? `- ${generationRules.globalRules.yearsConsistency}` : "",
    generationRules.globalRules?.projectAlignment ? `- ${generationRules.globalRules.projectAlignment}` : "",
    generationRules.globalRules?.environmentProgression ? `- ${generationRules.globalRules.environmentProgression}` : "",
    generationRules.globalRules?.noUnsupportedMetrics ? `- ${generationRules.globalRules.noUnsupportedMetrics}` : "",
    generationRules.globalRules?.skillSectionPrinciple ? `- ${generationRules.globalRules.skillSectionPrinciple}` : "",
    levelRulesWritingStyle(generationRules),
    "",
    "COMPANY AND ENVIRONMENT RULES",
    "- Suggest real, well-known companies that fit the domain and seniority for past roles.",
    "- Each work experience must have a different environment line.",
    "- Current role should use the strongest JD stack; older roles should use smaller foundational stacks.",
    "- Do not repeat the exact same environment across every job.",
    "",
    "CONTENT RULES",
    "- Use only JD-supported skills, responsibilities, and domain context.",
    "- Do not copy company marketing paragraphs, About Us text, or platform descriptions from the JD into bullets.",
    "- Do not use placeholder company names like 'Real healthcare company name' or 'City, ST'. Use real company names.",
    "- Each skills category must contain different items. Do not repeat the same four skills in every category.",
    "- Do not mention 'JD', 'job description', or 'aligned with the JD' inside resume content.",
    "- Do not invent percentages, dollar amounts, uptime figures, latency numbers, or other metrics unless the job description includes them.",
    "- Do not paste job requirement sentences verbatim into bullets; rewrite them as accomplishment bullets.",
    "- Each work experience entry must use distinct bullets. Do not repeat the same sentence across jobs with only the first verb changed.",
    "- Set header.name to Ideal Candidate and keep contact fields generic.",
    "- Set education to an empty string unless the JD clearly requires education.",
    "- Set meta.mode to ideal and meta.generatedBy to ai.",
    "",
    "OUTPUT FORMAT",
    "- Return ONLY one raw JSON object.",
    "- No markdown fences. No commentary.",
    "- Match this structure:",
    JSON.stringify(resumeOutputShapeHint(checklist), null, 2),
    "",
    "JOB DESCRIPTION",
    "---",
    jobDescription,
    "---"
  ].filter(Boolean).join("\n");
}

function buildOllamaRevisionUserPrompt({ resume, jobDescription, analysis, blueprint, generationRules, instruction, section, sectionPayloadRules }) {
  const checklist = buildLevelChecklist(analysis, generationRules);
  const writingBrief = extractWritingBrief(blueprint, generationRules);

  return [
    "TASK: Revise the requested resume section and return the full updated resume JSON.",
    "",
    `Requested section: ${section}`,
    `User instruction: ${instruction}`,
    "",
    "REVISION RULES",
    "- Start from currentResume and preserve every unchanged field.",
    "- Never change header or education.",
    "- Keep company, title, location, and dates unless the user explicitly asked to change them.",
    "- first/current = experience index 0, second = index 1, third = index 2.",
    "- Return ONLY raw JSON. No markdown fences.",
    "",
    "ROLE CONTEXT",
    `Target role: ${checklist.targetRole}`,
    `Required skills: ${checklist.requiredSkills.join(", ")}`,
    writingBrief.workExperience.bulletWriting.pattern ? `Bullet pattern: ${writingBrief.workExperience.bulletWriting.pattern}` : "",
    writingBrief.aiInstructions.jdTailoring ? `JD tailoring: ${writingBrief.aiInstructions.jdTailoring}` : "",
    generationRules.globalRules?.yearsConsistency ? `Years consistency: ${generationRules.globalRules.yearsConsistency}` : "",
    generationRules.globalRules?.projectAlignment ? `Project alignment: ${generationRules.globalRules.projectAlignment}` : "",
    "",
    "SECTION RULES",
    JSON.stringify(sectionPayloadRules, null, 2),
    "",
    "CURRENT RESUME JSON",
    JSON.stringify(resume, null, 2),
    "",
    "JOB DESCRIPTION",
    "---",
    jobDescription,
    "---"
  ].filter(Boolean).join("\n");
}

export function buildGenerationSystemPrompt(provider) {
  const base = [
    "You generate ideal-candidate benchmark resumes as a single JSON object.",
    "Depend only on the job description and job analysis for resume content.",
    "Use the layout blueprint only for structure, section order, density, formatting intent, and writing style.",
    "Do not use candidate-profile data. Do not copy reference-resume content. Do not mention that this is hypothetical.",
    "Set meta.mode to exactly ideal and meta.generatedBy to exactly ai.",
    "You may suggest real, well-known company names for work experience when the JD does not provide company history.",
    "Do not invent universities, certifications, metrics, percentages, or tools that are not in the JD or allowed adjacent skills.",
    "Do not add technologies, platforms, architecture components, domains, or business contexts absent from the JD or job analysis.",
    "Use generation rules for exact experience count, project count, bullet count, skill breadth, environment breadth, and date ranges.",
    "Any years-of-experience claim in the summary must match the work experience date ranges.",
    "Projects must align with work experience, company/domain context, and JD responsibilities.",
    "Generate a different environment line for each work experience entry.",
    "Do not leave skills, experience, or projects empty unless level rules explicitly allow zero items."
  ];

  if (isOllama(provider)) {
    base.push(
      "",
      "You are writing a strong human-quality resume, not a shallow template.",
      "Translate JD responsibilities into specific achievement-style bullets with technologies from the JD.",
      "Every work experience bullet should sound like real work done at that company in the JD domain.",
      "",
      "Follow this workflow:",
      "1. Read required counts and do not change them.",
      "2. Turn each JD responsibility into one or more resume bullets.",
      "3. Use required skills throughout summary, skills, environment lines, and bullets.",
      "4. Use different environment lines per job with stack progression across roles.",
      "5. Return only raw JSON with no markdown fences or commentary."
    );
  } else {
    base.push("Return only JSON matching the schema.");
  }

  return base.join("\n");
}

export function buildRevisionSystemPrompt(provider) {
  const base = [
    "You revise an existing resume JSON for an ideal-candidate benchmark app.",
    "Return the complete updated resume JSON, not only the changed section.",
    "Only change the requested section unless another section must change for strict consistency.",
    "Never change header or education; those are factual sections handled outside AI.",
    "Do not add fake personal education, personal contact data, unsupported certifications, or unsupported metrics.",
    "Keep company names, titles, locations, and dates unchanged unless the user explicitly asked to change them.",
    "For work experience changes, map ordinal language carefully: first means index 0, second means index 1, third means index 2.",
    "If the user asks for more skills in an experience, revise the environment line and bullets for that specific experience only.",
    "Follow the JD, job analysis, layout blueprint, level generation rules, year consistency rules, project alignment rules, and level-appropriate skill rules."
  ];

  if (isOllama(provider)) {
    base.push(
      "",
      "Preserve the writing quality of the existing resume.",
      "Make the revision specific and JD-aligned, not generic.",
      "Return only raw JSON with no markdown fences or commentary."
    );
  } else {
    base.push("Return only JSON matching the schema.");
  }

  return base.join("\n");
}

export function revisionPayloadRules(section, generationRules) {
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

export function buildGenerationUserPrompt({ jobDescription, analysis, blueprint, generationRules, provider }) {
  if (isOllama(provider)) {
    return buildOllamaGenerationUserPrompt({ jobDescription, analysis, blueprint, generationRules });
  }

  const checklist = buildLevelChecklist(analysis, generationRules);
  return JSON.stringify({
    task: "Generate the best ideal-candidate resume for this JD.",
    levelChecklist: checklist,
    writingBrief: extractWritingBrief(blueprint, generationRules),
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
        experienceEntries: checklist.experienceEntries,
        projectCount: checklist.projectCount,
        experienceBullets: generationRules.levelRules?.experienceBullets,
        projectBullets: checklist.projectBullets,
        skillCategories: checklist.skillCategoryCount,
        environmentItemsPerExperience: checklist.environmentItemsPerExperience
      },
      consistencyRules: {
        yearsConsistency: generationRules.globalRules?.yearsConsistency,
        projectAlignment: generationRules.globalRules?.projectAlignment,
        projectPolicy: generationRules.levelRules?.projectPolicy,
        dateRanges: checklist.dateRanges,
        totalYearsRange: generationRules.levelRules?.totalYearsRange,
        environmentProgression: generationRules.levelRules?.environmentProgression
      },
      skillRules: {
        categoryNames: checklist.skillCategoryNames,
        itemsPerCategory: checklist.itemsPerSkillCategory,
        allowAcademicFoundations: generationRules.levelRules?.skills?.allowAcademicFoundations,
        bannedSkillItems: checklist.bannedSkillItems,
        adjacentSkillExamples: checklist.adjacentSkillExamples
      },
      companyNameMode: generationRules.globalRules?.companyNameMode || "ai_suggested_real_companies"
    }
  });
}

export function buildRevisionUserPrompt({ resume, jobDescription, analysis, blueprint, generationRules, instruction, section, sectionPayloadRules, provider }) {
  if (isOllama(provider)) {
    return buildOllamaRevisionUserPrompt({
      resume,
      jobDescription,
      analysis,
      blueprint,
      generationRules,
      instruction,
      section,
      sectionPayloadRules
    });
  }

  return JSON.stringify({
    task: "Revise the requested resume section.",
    requestedSection: section,
    userInstruction: instruction,
    currentResume: resume,
    levelChecklist: buildLevelChecklist(analysis, generationRules),
    writingBrief: extractWritingBrief(blueprint, generationRules),
    jobDescription,
    jobAnalysis: analysis,
    layoutBlueprint: blueprint,
    generationRules,
    sectionPayloadRules
  });
}
