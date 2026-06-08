import { normalize, tokenize, unique } from "./text-utils.js";

const skillCatalog = [
  "Java", "JavaScript", "TypeScript", "Python", "Node.js", "React.js", "Angular", "Vue.js",
  "Spring Boot", "Spring MVC", "Spring Cloud", "Spring Security", "Hibernate", "JPA", "RESTful APIs",
  "SOAP APIs", "GraphQL", "Microservices", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Jenkins",
  "GitHub Actions", "GitLab CI/CD", "CI/CD", "Kafka", "Apache Kafka", "Kafka Streams", "RabbitMQ",
  "ActiveMQ", "PostgreSQL", "Oracle", "MySQL", "SQL Server", "MongoDB", "Redis", "Elasticsearch",
  "Splunk", "Prometheus", "Grafana", "JUnit", "Mockito", "Jest", "Selenium", "Cucumber", "Agile",
  "Terraform", "CloudFormation", "OpenAPI", "Swagger", "OAuth2", "JWT"
];

const aliases = new Map([
  ["react", "React.js"],
  ["reactjs", "React.js"],
  ["node", "Node.js"],
  ["nodejs", "Node.js"],
  ["spring", "Spring Boot"],
  ["springboot", "Spring Boot"],
  ["rest", "RESTful APIs"],
  ["rest api", "RESTful APIs"],
  ["restful", "RESTful APIs"],
  ["microservice", "Microservices"],
  ["microservices", "Microservices"],
  ["kafka", "Apache Kafka"],
  ["k8s", "Kubernetes"],
  ["ci cd", "CI/CD"],
  ["cicd", "CI/CD"],
  ["postgres", "PostgreSQL"],
  ["postgresql", "PostgreSQL"],
  ["js", "JavaScript"],
  ["ts", "TypeScript"],
  ["oauth", "OAuth2"],
  ["jwt", "JWT"],
  ["aws sqs", "AWS SQS"],
  ["aws sns", "AWS SNS"]
]);

const levelSignals = {
  intern: ["intern", "internship", "co-op", "coop", "student", "summer intern", "campus"],
  entry: ["entry level", "entry-level", "new grad", "new graduate", "graduate", "0-1 years", "0+ years", "associate software"],
  junior: ["junior", "jr.", "jr ", "1+ years", "1-2 years", "2+ years"],
  midlevel: ["mid level", "mid-level", "intermediate", "software engineer ii", "3+ years", "3-5 years", "4+ years"],
  senior: ["senior", "sr.", "sr ", "lead", "principal", "staff", "architect", "5+ years", "7+ years", "10+ years"]
};

const domainSignals = [
  ["finance", ["bank", "banking", "financial", "trading", "loan", "payment", "credit", "risk", "compliance", "audit"]],
  ["healthcare", ["healthcare", "clinical", "patient", "pharma", "hipaa", "medical", "life sciences"]],
  ["telecom", ["telecom", "wireless", "network", "billing", "subscriber"]],
  ["automotive", ["automotive", "vehicle", "fleet", "diagnostic", "manufacturing"]],
  ["retail", ["retail", "ecommerce", "e-commerce", "customer", "commerce"]]
];

export function analyzeJobDescription(jdText, options = {}) {
  const text = String(jdText || "");
  const normalized = ` ${normalize(text)} `;
  const tokens = tokenize(text);
  const detectedLevel = options.level && options.level !== "auto" ? options.level : detectLevel(normalized);
  const detectedSkills = detectSkills(normalized);
  const targetRole = options.targetRole?.trim() || detectRole(text) || defaultRoleForLevel(detectedLevel);
  const companyName = options.companyName?.trim() || detectCompany(text);
  const location = options.location?.trim() || detectLocation(text);

  return {
    targetRole,
    companyName,
    location,
    level: detectedLevel,
    domain: detectDomain(normalized),
    requiredSkills: detectedSkills.slice(0, 12),
    preferredSkills: detectedSkills.slice(12, 24),
    responsibilities: detectResponsibilities(text),
    tokens,
    tokenCount: tokens.length
  };
}

function detectLevel(normalized) {
  const scores = Object.entries(levelSignals).map(([level, signals]) => ({
    level,
    score: signals.reduce((sum, signal) => sum + (normalized.includes(` ${normalize(signal)} `) ? 1 : 0), 0)
  }));

  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score > 0) return scores[0].level;
  return "midlevel";
}

function detectSkills(normalized) {
  const found = [];

  for (const skill of skillCatalog) {
    if (normalized.includes(` ${normalize(skill)} `)) found.push(skill);
  }

  for (const [alias, canonical] of aliases.entries()) {
    if (normalized.includes(` ${alias} `)) found.push(canonical);
  }

  return unique(found);
}

function detectRole(text) {
  const patterns = [
    /job title\s*:\s*([^\n]+)/i,
    /title\s*:\s*([^\n]+)/i,
    /role\s*:\s*([^\n]+)/i,
    /position\s*:\s*([^\n]+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanupLine(match[1]);
  }

  const commonRole = text.match(/\b((senior|sr\.?|lead|principal|staff|junior|jr\.?|entry[- ]level|mid[- ]level)?\s*(java|full stack|backend|frontend|software|cloud|devops)\s+(developer|engineer|architect|intern))\b/i);
  return commonRole ? titleCase(cleanupLine(commonRole[1])) : "";
}

function detectCompany(text) {
  const patterns = [
    /company\s*:\s*([^\n]+)/i,
    /client\s*:\s*([^\n]+)/i,
    /employer\s*:\s*([^\n]+)/i,
    /\bat\s+([A-Z][A-Za-z0-9&.,' -]{2,50})(?:\s+is|\s+we|\s+as|\s*,|\s*\n)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanupLine(match[1]);
  }

  return "";
}

function detectLocation(text) {
  const patterns = [
    /(?:job\s*)?location\s*:\s*([^\n]+)/i,
    /work\s+location\s*:\s*([^\n]+)/i,
    /based\s+in\s+([A-Z][A-Za-z .'-]+,\s*[A-Z]{2})/i,
    /\b(remote|hybrid|onsite|on-site)\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanupLine(match[1]);
  }

  const cityState = text.match(/\b([A-Z][A-Za-z .'-]+,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY))\b/);
  return cityState ? cleanupLine(cityState[1]) : "";
}

function detectDomain(normalized) {
  for (const [domain, signals] of domainSignals) {
    if (signals.some((signal) => normalized.includes(` ${normalize(signal)} `))) return domain;
  }

  return "general technology";
}

function detectResponsibilities(text) {
  return text
    .split(/\n+/)
    .map((line) => cleanupLine(line.replace(/^[-*•]\s*/, "")))
    .filter((line) => line.length > 35)
    .filter((line) => /\b(design|develop|build|implement|maintain|support|deploy|integrate|collaborate|test|optimize|lead|own)\b/i.test(line))
    .slice(0, 8);
}

function defaultRoleForLevel(level) {
  const roles = {
    intern: "Software Engineering Intern",
    entry: "Software Engineer",
    junior: "Junior Software Engineer",
    midlevel: "Software Engineer",
    senior: "Senior Software Developer"
  };
  return roles[level] || roles.midlevel;
}

function cleanupLine(line) {
  return String(line || "").replace(/\s+/g, " ").replace(/[|•]+$/g, "").trim();
}

function titleCase(value) {
  return value
    .split(/\s+/)
    .map((word) => (word.length <= 3 && word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}
