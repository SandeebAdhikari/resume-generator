import { companyPlaceholder, defaultResponsibilities, sentence } from "./resume-content.js";
import { unique } from "./text-utils.js";

export function generateIdealResumeSchema({ analysis, blueprint }) {
  const matchedSkills = unique([...analysis.requiredSkills, ...analysis.preferredSkills]);
  const experiences = buildExperienceFromJd(analysis, matchedSkills);

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

function buildExperienceFromJd(analysis, skills) {
  const responsibilities = defaultResponsibilities(analysis);
  const primaryBullets = responsibilities.map((responsibility) => sentence(responsibility)).slice(0, 8);
  const supportBullets = responsibilities.slice(0, 4).map((responsibility) => sentence(responsibility));

  return [
    {
      company: analysis.companyName || companyPlaceholder(0),
      location: analysis.location || "Location",
      title: analysis.targetRole,
      dates: "Dates",
      environment: skills,
      bullets: primaryBullets
    },
    {
      company: companyPlaceholder(1),
      location: analysis.location || "Location",
      title: previousTitleForLevel(analysis.level),
      dates: "Dates",
      environment: skills.slice(0, Math.max(4, Math.floor(skills.length * 0.7))),
      bullets: supportBullets
    }
  ];
}

function buildProjectsFromJd(analysis, skills) {
  const responsibility = defaultResponsibilities(analysis)[0];
  return [
    {
      name: `${analysis.domain || "Technical"} Platform Enhancement`,
      bullets: [
        sentence(responsibility),
        skills.length ? `Built with ${skills.slice(0, 6).join(", ")}.` : "Built using core technologies from the role."
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
