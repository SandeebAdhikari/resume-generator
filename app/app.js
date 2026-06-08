import { analyzeJobDescription } from "./core/jd-analyzer.js";
import { resumeLevels } from "./core/resume-config.js";
import { loadLayoutBlueprint } from "./core/layout-loader.js";
import { loadResumeLevelRules } from "./core/rules-loader.js";
import { generateIdealResumeSchema } from "./core/ideal-resume-generator.js";
import { generateAiResumeSchema } from "./core/ai-resume-client.js";
import { reviseAiResumeSchema } from "./core/ai-revision-client.js";
import { renderResume } from "./core/resume-renderer.js";
import { escapeHtml } from "./core/text-utils.js";

const defaultJd = `Paste a job description here. Example keywords the app will detect: Java, Spring Boot, microservices, REST APIs, AWS, Docker, Kubernetes, Kafka, React, SQL, CI/CD, Agile, unit testing, system design, and production support.`;

const elements = {
  resumeLevel: document.querySelector("#resumeLevel"),
  jobDescription: document.querySelector("#jobDescription"),
  generateBtn: document.querySelector("#generateBtn"),
  printBtn: document.querySelector("#printBtn"),
  copyBtn: document.querySelector("#copyBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  revisionInstructions: document.querySelector("#revisionInstructions"),
  reviseBtn: document.querySelector("#reviseBtn"),
  resumePreview: document.querySelector("#resumePreview"),
  keywordChips: document.querySelector("#keywordChips"),
  matchScore: document.querySelector("#matchScore"),
  tailoringNotes: document.querySelector("#tailoringNotes")
};

let generationId = 0;
let currentResumeSchema = null;
let currentAnalysis = null;
let currentBlueprint = null;
let currentGenerationRules = null;
let currentJobDescription = "";

async function generateResume() {
  const currentGeneration = ++generationId;
  const jdText = elements.jobDescription.value.trim();
  const selectedLevel = elements.resumeLevel.value;

  setBusy(true);

  try {
    const analysis = analyzeJobDescription(jdText, {
      level: selectedLevel
    });

    if (currentGeneration !== generationId) return;

    const blueprint = await loadLayoutBlueprint(analysis.level);
    const generationRules = await loadResumeLevelRules(analysis.level);
    const schema = jdText
      ? await generateAiResumeSchema({ jobDescription: jdText, analysis, blueprint, generationRules })
      : generateIdealResumeSchema({ analysis, blueprint });

    if (currentGeneration !== generationId) return;

    currentResumeSchema = schema;
    currentAnalysis = analysis;
    currentBlueprint = blueprint;
    currentGenerationRules = generationRules;
    currentJobDescription = jdText;

    elements.resumePreview.innerHTML = renderResume(schema, blueprint);
    updateSidebar({ analysis, blueprint, schema, generationRules });
  } catch (error) {
    elements.resumePreview.innerHTML = `
      <section>
        <h3>Generation Error</h3>
        <p>${escapeHtml(error.message)}</p>
      </section>
    `;
    showToast("Could not generate resume");
  } finally {
    if (currentGeneration === generationId) setBusy(false);
  }
}

async function reviseResume() {
  const instruction = elements.revisionInstructions.value.trim();

  if (!instruction) {
    showToast("Add a revision request first");
    return;
  }

  if (!currentResumeSchema || !currentAnalysis || !currentBlueprint || !currentGenerationRules) {
    showToast("Generate a resume before revising");
    return;
  }

  setBusy(true, "Revising...");

  try {
    const payload = await reviseAiResumeSchema({
      resume: currentResumeSchema,
      jobDescription: currentJobDescription,
      analysis: currentAnalysis,
      blueprint: currentBlueprint,
      generationRules: currentGenerationRules,
      instruction
    });

    if (payload.status === "needs_input") {
      const missing = payload.missingFields?.length ? ` Missing: ${payload.missingFields.join(", ")}.` : "";
      showToast(`${payload.message || "More information needed."}${missing}`);
      addRevisionNote(payload.message || "More information needed before changing that section.");
      return;
    }

    currentResumeSchema = payload.resume;
    elements.resumePreview.innerHTML = renderResume(currentResumeSchema, currentBlueprint);
    updateSidebar({
      analysis: currentAnalysis,
      blueprint: currentBlueprint,
      schema: currentResumeSchema,
      generationRules: currentGenerationRules
    });
    addRevisionNote(`Revised ${payload.section || "resume"}: ${instruction}`);
    elements.revisionInstructions.value = "";
    showToast("Resume revised");
  } catch (error) {
    showToast(error.message || "Could not revise resume");
  } finally {
    setBusy(false);
  }
}

function updateSidebar({ analysis, blueprint, schema, generationRules }) {
  const matchedSkills = schema.meta.matchedSkills;
  const maxRelevantSkills = Math.max(12, 34);
  const score = Math.min(98, Math.round((matchedSkills.length / maxRelevantSkills) * 100));
  const selectedBulletCount = schema.sections.workExperience.reduce((sum, experience) => sum + experience.bullets.length, 0);
  const level = resumeLevels[analysis.level] || resumeLevels.midlevel;

  elements.matchScore.textContent = `${score}%`;
  elements.keywordChips.innerHTML = matchedSkills.length
    ? matchedSkills.slice(0, 18).map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`).join("")
    : `<span class="chip">No JD keywords yet</span>`;

  const notes = [];
  const aiGenerated = schema.meta.generatedBy?.toLowerCase() === "ai";
  notes.push(aiGenerated ? "Mode: AI-generated ideal candidate benchmark." : "Mode: local blank-state preview. Paste a JD to generate with AI.");
  notes.push(`Detected level: ${labelForLevel(analysis.level)}. Loaded ${blueprint.level} layout blueprint.`);
  if (generationRules?.levelRules) {
    notes.push(`Applied level rules: ${generationRules.levelRules.experienceEntries} experience entries, ${generationRules.levelRules.projectCount} project section item(s), ${generationRules.levelRules.skills.categoryCount} skill categories.`);
  }
  if (analysis.domain) notes.push(`Detected domain: ${analysis.domain}.`);
  if (matchedSkills.length) {
    notes.push(`Prioritized ${matchedSkills.slice(0, 6).join(", ")} in the summary, skills, and bullet ranking.`);
  } else {
    notes.push("Paste a complete JD to prioritize exact tools, platforms, and responsibilities.");
  }
  notes.push(level.note);
  notes.push(aiGenerated
    ? `Generated ${selectedBulletCount} experience bullets from the JD and loaded layout blueprint.`
    : `Created ${selectedBulletCount} placeholder experience bullets from JD responsibilities. AI generation will replace these after a JD is pasted.`);
  notes.push(`${analysis.tokenCount} meaningful JD terms were analyzed locally in your browser.`);

  elements.tailoringNotes.innerHTML = notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
}

async function copyResumeText() {
  const text = elements.resumePreview.innerText.trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    showToast("Resume text copied");
  } catch {
    showToast("Select the preview and copy manually");
  }
}

function setBusy(isBusy, reviseLabel = "Revise Resume") {
  elements.generateBtn.disabled = isBusy;
  elements.reviseBtn.disabled = isBusy;
  elements.generateBtn.textContent = isBusy ? "Generating..." : "Generate Resume";
  elements.reviseBtn.textContent = isBusy ? reviseLabel : "Revise Resume";
}

function addRevisionNote(message) {
  const item = document.createElement("li");
  item.textContent = message;
  elements.tailoringNotes.prepend(item);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "status-toast";
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 2200);
}

function labelForLevel(level) {
  const labels = {
    intern: "Intern",
    entry: "Entry Level",
    junior: "Junior",
    midlevel: "Mid-Level",
    senior: "Senior"
  };
  return labels[level] || "Mid-Level";
}

elements.generateBtn.addEventListener("click", generateResume);
elements.reviseBtn.addEventListener("click", reviseResume);
elements.printBtn.addEventListener("click", () => window.print());
elements.copyBtn.addEventListener("click", copyResumeText);
elements.resumeLevel.addEventListener("change", () => {
  generateResume();
});
elements.resetBtn.addEventListener("click", () => {
  elements.resumeLevel.value = "auto";
  elements.jobDescription.value = "";
  elements.revisionInstructions.value = "";
  generateResume();
});

elements.jobDescription.value = "";
elements.jobDescription.placeholder = defaultJd;
generateResume();
