import { unique } from "./text-utils.js";

export function generateIdealResumeSchema({ analysis, blueprint }) {
  const matchedSkills = unique([...analysis.requiredSkills, ...analysis.preferredSkills]);
  const experiences = buildExperienceFromJd(analysis, blueprint, matchedSkills);

  return {
    meta: {
      mode: "ideal",
      level: analysis.level,
      layout: blueprint.level,
      targetRole: analysis.targetRole,
      companyName: analysis.companyName,
      location: analysis.location || "",
      domain: analysis.domain,
      matchedSkills,
      generatedBy: "local"
    },
    header: {
      name: "Ideal Candidate",
      targetRole: analysis.targetRole,
      location: analysis.location || "Location",
      phone: "Phone",
      email: "Email",
      portfolio: "Portfolio",
      linkedin: "LinkedIn"
    },
    sections: {
      professionalSummary: buildIdealSummary(analysis, matchedSkills),
      skills: buildSkillsSection(matchedSkills),
      workExperience: experiences,
      projects: buildProjectsFromJd(analysis, matchedSkills),
      education: "Education aligned with the job description"
    }
  };
}

function buildExperienceFromJd(analysis, blueprint, skills) {
  const limits = getExperienceBulletLimits(blueprint.level);
  const responsibilities = analysis.responsibilities.length
    ? analysis.responsibilities
    : [`Deliver work aligned with ${analysis.targetRole} responsibilities from the job description.`];
  const primaryBullets = responsibilities.map((responsibility) => sentence(responsibility)).slice(0, limits[0]);
  const supportBullets = responsibilities
    .slice(0, limits[1] || 4)
    .map((responsibility) => sentence(responsibility));

  return [
    {
      company: analysis.companyName || "Company from JD",
      location: analysis.location || "Location",
      title: analysis.targetRole,
      dates: "Dates",
      environment: skills,
      bullets: primaryBullets
    },
    {
      company: "Prior relevant organization",
      location: analysis.location || "Location",
      title: previousTitleForLevel(analysis.level),
      dates: "Dates",
      environment: skills.slice(0, Math.max(4, Math.floor(skills.length * 0.7))),
      bullets: supportBullets
    }
  ];
}

function buildProjectsFromJd(analysis, skills) {
  const responsibility = analysis.responsibilities[0] || `${analysis.targetRole} responsibilities`;
  return [
    {
      name: "JD-Aligned Technical Project",
      bullets: [
        sentence(responsibility),
        skills.length ? `Demonstrates the JD-required stack: ${skills.slice(0, 8).join(", ")}.` : "Demonstrates the technical responsibilities listed in the JD.",
        "Should be replaced by AI-generated project content once the AI generation stage is connected."
      ]
    }
  ];
}

function buildSkillsSection(skills) {
  return {
    "JD Skills": skills.length ? skills : ["Skills extracted from the job description will appear here"]
  };
}

function buildIdealSummary(analysis, skills) {
  const skillPhrase = skills.length ? ` Required JD skills include ${skills.slice(0, 10).join(", ")}.` : "";
  const companyPhrase = analysis.companyName ? ` for ${analysis.companyName}` : "";
  return `Ideal ${analysis.targetRole} profile generated strictly from the job description${companyPhrase}.${skillPhrase} The AI generation stage should expand this into a polished summary using only the JD and the selected layout blueprint.`;
}

function getExperienceBulletLimits(level) {
  const limits = {
    intern: [6, 5],
    entry: [8, 5],
    junior: [8, 6],
    midlevel: [9, 7, 5],
    senior: [10, 8, 6]
  };
  return limits[level] || limits.midlevel;
}

function previousTitleForLevel(level) {
  const titles = {
    intern: "Technical Project Contributor",
    entry: "Software Engineering Intern",
    junior: "Associate Software Engineer",
    midlevel: "Software Developer",
    senior: "Software Developer"
  };
  return titles[level] || titles.midlevel;
}

function sentence(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
