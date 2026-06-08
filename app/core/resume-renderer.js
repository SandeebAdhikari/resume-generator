import { escapeHtml } from "./text-utils.js";

export function renderResume(schema, blueprint) {
  const sectionOrder = blueprint.sectionOrder || ["professionalSummary", "skills", "workExperience", "projects", "education"];
  const body = sectionOrder.map((sectionName) => renderSection(sectionName, schema, blueprint)).filter(Boolean).join("");

  return `
    ${renderHeader(schema, blueprint)}
    ${body}
  `;
}

function renderHeader(schema, blueprint) {
  const header = schema.header;
  const headerSpec = blueprint.header || {};
  const name = headerSpec.name?.case === "uppercase" ? header.name.toUpperCase() : header.name;
  const contactItems = (headerSpec.contact?.items || ["location", "phone", "email", "portfolio"])
    .map((item) => header[item])
    .filter(Boolean);
  const separator = headerSpec.contact?.separator || " | ";
  const showTitle = headerSpec.lineOrder?.includes("targetTitle") || headerSpec.lineOrder?.includes("title");
  const showLocationLine = headerSpec.lineOrder?.includes("location");

  return `
    <header class="resume-header" data-layout-level="${escapeHtml(blueprint.level)}">
      <h2>${escapeHtml(name)}</h2>
      ${showLocationLine ? `<div class="contact">${escapeHtml(header.location)}</div>` : ""}
      ${showTitle ? `<div class="role">${escapeHtml(header.targetRole)}</div>` : ""}
      <div class="contact">${escapeHtml(contactItems.join(separator))}</div>
    </header>
  `;
}

function renderSection(sectionName, schema, blueprint) {
  const handlers = {
    summary: () => renderSummary(schema, blueprint, "summary"),
    professionalSummary: () => renderSummary(schema, blueprint, "professionalSummary"),
    skills: () => renderSkills(schema, blueprint, "skills"),
    keySkills: () => renderSkills(schema, blueprint, "keySkills"),
    technicalSkills: () => renderSkills(schema, blueprint, "technicalSkills"),
    workExperience: () => renderExperience(schema, blueprint, "workExperience"),
    experience: () => renderExperience(schema, blueprint, "experience"),
    technicalProjects: () => renderProjects(schema, blueprint, "technicalProjects"),
    projects: () => renderProjects(schema, blueprint, "projects"),
    education: () => renderEducation(schema, blueprint, "education"),
    certifications: () => "",
    links: () => ""
  };

  return handlers[sectionName] ? handlers[sectionName]() : "";
}

function getHeading(blueprint, sectionName, fallback) {
  return blueprint.sections?.[sectionName]?.heading || fallback;
}

function renderSummary(schema, blueprint, sectionName) {
  return `
    <section>
      <h3>${escapeHtml(getHeading(blueprint, sectionName, "Professional Summary"))}</h3>
      <p>${escapeHtml(schema.sections.professionalSummary)}</p>
    </section>
  `;
}

function renderSkills(schema, blueprint, sectionName) {
  const skillGroups = Array.isArray(schema.sections.skills)
    ? schema.sections.skills
    : Object.entries(schema.sections.skills).map(([category, items]) => ({ category, items }));
  const skillsHtml = skillGroups
    .map((group) => `<p><strong>${escapeHtml(group.category)}:</strong> ${escapeHtml(group.items.join(", "))}</p>`)
    .join("");

  return `
    <section>
      <h3>${escapeHtml(getHeading(blueprint, sectionName, "Skills"))}</h3>
      <div class="skills-grid">${skillsHtml}</div>
    </section>
  `;
}

function renderExperience(schema, blueprint, sectionName) {
  const experienceHtml = schema.sections.workExperience
    .map((experience) => `
      <section class="job-entry">
        <div class="job-heading">
          <strong>${escapeHtml(experience.company)}</strong>
          <span>${escapeHtml(experience.location)}</span>
        </div>
        <div class="job-title">
          <span>${escapeHtml(experience.title)}</span>
          <span>${escapeHtml(experience.dates)}</span>
        </div>
        <ul>${listItems(experience.bullets)}</ul>
        ${shouldShowEnvironment(blueprint) ? `<p class="environment-line"><strong>Environment:</strong> ${escapeHtml(experience.environment.join(", "))}</p>` : ""}
      </section>
    `)
    .join("");

  return `
    <section>
      <h3>${escapeHtml(getHeading(blueprint, sectionName, "Work Experience"))}</h3>
      ${experienceHtml}
    </section>
  `;
}

function renderProjects(schema, blueprint, sectionName) {
  const projectHtml = schema.sections.projects
    .map((project) => `
      <section class="project-entry">
        <p><strong>${escapeHtml(project.name)}</strong></p>
        <ul>${listItems(project.bullets)}</ul>
      </section>
    `)
    .join("");

  return `
    <section>
      <h3>${escapeHtml(getHeading(blueprint, sectionName, "Projects"))}</h3>
      ${projectHtml}
    </section>
  `;
}

function renderEducation(schema, blueprint, sectionName) {
  return `
    <section>
      <h3>${escapeHtml(getHeading(blueprint, sectionName, "Education"))}</h3>
      <p>${escapeHtml(schema.sections.education)}</p>
    </section>
  `;
}

function listItems(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function shouldShowEnvironment(blueprint) {
  return Boolean(blueprint.sections?.workExperience?.environmentLine?.includeWhenUseful);
}
