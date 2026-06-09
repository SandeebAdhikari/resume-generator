import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAiConfig, getAiConfigError } from "./core/ai-config.js";
import { generateAiResume, reviseAiResume } from "./core/ai-service.js";
import {
  classifyRevisionSection,
  reviseEducationSection,
  reviseHeaderSection
} from "./core/revision-handlers.js";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

await loadDotEnv();

const port = Number(process.env.PORT || 8787);
const aiConfig = getAiConfig();

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
  console.log(`AI provider: ${aiConfig.provider} (${aiConfig.model})`);
});

async function handleGenerateResume(request, response) {
  const configError = getAiConfigError(aiConfig);
  if (configError) {
    sendJson(response, 500, { error: configError });
    return;
  }

  const body = await readRequestJson(request);
  const { jobDescription, analysis, blueprint, generationRules } = body;

  if (!jobDescription || !analysis || !blueprint || !generationRules) {
    sendJson(response, 400, { error: "Missing jobDescription, analysis, blueprint, or generationRules." });
    return;
  }

  const resume = await generateAiResume({ jobDescription, analysis, blueprint, generationRules }, aiConfig);
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

  const configError = getAiConfigError(aiConfig);
  if (configError) {
    sendJson(response, 500, { error: configError });
    return;
  }

  const revisedResume = await reviseAiResume({
    resume,
    jobDescription,
    analysis,
    blueprint,
    generationRules,
    instruction,
    section
  }, aiConfig);

  sendJson(response, 200, { status: "updated", section, resume: revisedResume });
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
      if (key) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
