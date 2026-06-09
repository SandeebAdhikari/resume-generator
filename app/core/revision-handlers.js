export function classifyRevisionSection(instruction) {
  const text = String(instruction || "").toLowerCase();

  if (/\b(header|contact|phone|email|linkedin|portfolio|name)\b/.test(text)) return "header";
  if (/\b(education|school|university|college|degree|gpa|coursework|certification|certifications)\b/.test(text)) return "education";
  if (/\b(project|projects)\b/.test(text)) return "projects";
  if (/\b(experience|job|company|role|bullet|bullets|environment|first|second|third|current|previous)\b/.test(text)) return "workExperience";
  if (/\b(skill|skills|tools|technologies|tech stack|stack)\b/.test(text)) return "skills";
  if (/\b(summary|professional summary|profile)\b/.test(text)) return "professionalSummary";

  return "general";
}

export function reviseHeaderSection(resume, instruction, analysis) {
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

export function reviseEducationSection(resume, instruction) {
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
