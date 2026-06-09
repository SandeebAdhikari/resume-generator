import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeJobDescription } from "../core/jd-analyzer.js";
import { generateAiResume } from "../core/ai-service.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const jobDescription = `Java Developer

We are hiring a Java Developer to build scalable healthcare applications.

Requirements:
- 3+ years of experience with Java and Spring Boot
- Experience with microservices architecture and REST APIs
- Agile development methodologies
- Design and implement scalable, efficient, and maintainable Java applications
- Collaborate with cross-functional teams to define, design, and deliver new features
- Solid experience with object-oriented design, data structures, and algorithms

Nice to have: Docker, Kubernetes, CI/CD, JUnit, Mockito, PostgreSQL
`;

async function loadGenerationContext() {
  const analysis = analyzeJobDescription(jobDescription, { level: "midlevel" });
  const blueprint = JSON.parse(await readFile(resolve(rootDir, "layouts/midlevel.json"), "utf8"));
  const rulesCache = JSON.parse(await readFile(resolve(rootDir, "rules/resume-level-rules.json"), "utf8"));
  const generationRules = {
    globalRules: rulesCache.globalRules,
    levelRules: rulesCache.levels.midlevel,
    level: "midlevel"
  };
  return { jobDescription, analysis, blueprint, generationRules };
}

function summarizeResume(label, resume, elapsedMs) {
  const skills = resume.sections?.skills || [];
  const jobs = resume.sections?.workExperience || [];
  const projects = resume.sections?.projects || [];
  const bullets = jobs.flatMap((job) => job.bullets || []);
  const metrics = bullets.filter((bullet) => /\d+(\.\d+)?%|\b99\.\d+%|\b\d+x\b/i.test(bullet));
  const companies = jobs.map((job) => job.company);
  const skillLines = skills.map((group) => `${group.category}: ${(group.items || []).join(", ")}`);

  return {
    label,
    elapsedSec: Math.round(elapsedMs / 1000),
    summary: resume.sections?.professionalSummary?.slice(0, 180) + "...",
    companies,
    skillLines,
    jobBullets: jobs.map((job, index) => ({
      title: `${job.company} — ${job.title}`,
      bullets: (job.bullets || []).slice(0, 4)
    })),
    projects: projects.map((project) => ({
      name: project.name,
      bullets: project.bullets || []
    })),
    metricBullets: metrics,
    metricCount: metrics.length,
    totalBullets: bullets.length
  };
}

async function runModel(model, context) {
  const config = {
    provider: "ollama",
    model,
    baseUrl: "http://127.0.0.1:11434",
    numCtx: 8192,
    numPredict: 6000
  };

  const started = Date.now();
  const resume = await generateAiResume(context, config);
  const elapsedMs = Date.now() - started;
  return summarizeResume(model, resume, elapsedMs);
}

const context = await loadGenerationContext();
const models = ["qwen3:8b", "qwen2.5:14b"];
const results = [];

for (const model of models) {
  console.log(`\n=== Generating with ${model} ===`);
  try {
    const result = await runModel(model, context);
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    results.push({ label: model, error: error.message });
    console.error(`${model} failed:`, error.message);
  }
}

const outPath = resolve(rootDir, "scripts/model-comparison.json");
await writeFile(outPath, JSON.stringify({ jobDescription, results }, null, 2));
console.log(`\nSaved comparison to ${outPath}`);
