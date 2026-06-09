import { getAiConfig } from "./ai-config.js";
import {
  buildGenerationSystemPrompt,
  buildGenerationUserPrompt,
  buildRevisionSystemPrompt,
  buildRevisionUserPrompt,
  revisionPayloadRules
} from "./ai-prompts.js";
import { parseAiJsonText, requestStructuredJson } from "./ai-providers.js";
import { normalizeAiResume } from "./resume-normalizer.js";

export async function generateAiResume({ jobDescription, analysis, blueprint, generationRules }, config = getAiConfig()) {
  const text = await requestStructuredJson({
    config,
    schemaName: "ideal_resume",
    systemPrompt: buildGenerationSystemPrompt(config.provider),
    userPrompt: buildGenerationUserPrompt({
      jobDescription,
      analysis,
      blueprint,
      generationRules,
      provider: config.provider
    })
  });

  return normalizeAiResume(parseAiJsonText(text), analysis, blueprint, generationRules);
}

export async function reviseAiResume({
  resume,
  jobDescription,
  analysis,
  blueprint,
  generationRules,
  instruction,
  section
}, config = getAiConfig()) {
  const text = await requestStructuredJson({
    config,
    schemaName: "revised_ideal_resume",
    systemPrompt: buildRevisionSystemPrompt(config.provider),
    userPrompt: buildRevisionUserPrompt({
      resume,
      jobDescription,
      analysis,
      blueprint,
      generationRules,
      instruction,
      section,
      sectionPayloadRules: revisionPayloadRules(section, generationRules),
      provider: config.provider
    })
  });

  return normalizeAiResume(parseAiJsonText(text), analysis, blueprint, generationRules, {
    preserveHeader: resume.header,
    preserveEducation: resume.sections?.education
  });
}
