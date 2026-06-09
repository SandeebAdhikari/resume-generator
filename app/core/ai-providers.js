import { resumeJsonSchema } from "./resume-schema.js";

export function parseAiJsonText(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || trimmed).trim();
  try {
    return JSON.parse(candidate);
  } catch (error) {
    throw new Error("Ollama returned invalid resume JSON. Try again or restart Ollama if it was stuck.");
  }
}

function extractOpenAiOutputText(payload) {
  return payload.output
    ?.flatMap((item) => item.content || [])
    ?.filter((content) => content.type === "output_text")
    ?.map((content) => content.text)
    ?.join("");
}

async function requestOpenAiStructuredJson({ config, schemaName, systemPrompt, userPrompt }) {
  const apiResponse = await fetch(`${config.baseUrl}/v1/responses`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] }
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema: resumeJsonSchema
        }
      }
    })
  });

  const payload = await apiResponse.json();

  if (!apiResponse.ok) {
    const message = payload.error?.message || "OpenAI API request failed.";
    if (apiResponse.status === 401) {
      throw new Error(
        "OpenAI API key is invalid or expired. Set AI_PROVIDER=ollama in app/.env to use local Ollama, or replace OPENAI_API_KEY with a valid key."
      );
    }
    throw new Error(message);
  }

  const text = payload.output_text || extractOpenAiOutputText(payload);
  if (!text) throw new Error("OpenAI response did not include resume JSON.");
  return text;
}

async function requestOllamaStructuredJson({ config, systemPrompt, userPrompt }) {
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 600000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let apiResponse;
  try {
    apiResponse = await fetch(`${config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        format: resumeJsonSchema,
        options: {
          temperature: 0,
          num_ctx: config.numCtx,
          num_predict: config.numPredict
        }
      })
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        `Ollama timed out after ${Math.round(timeoutMs / 60000)} minutes. Restart Ollama (docker compose restart ollama) or raise OLLAMA_TIMEOUT_MS. Docker Ollama on Mac is often slow on CPU.`
      );
    }
    throw new Error(
      `Lost connection to Ollama at ${config.baseUrl} during generation (${error.message}). Ollama may still be running but too slow or stuck — common with Docker Ollama on Mac. Try: docker compose restart ollama, wait 2–5 minutes per resume, or use the native Ollama app instead of Docker.`
    );
  } finally {
    clearTimeout(timeout);
  }

  const payload = await apiResponse.json();

  if (!apiResponse.ok) {
    throw new Error(payload.error || "Ollama API request failed.");
  }

  const text = payload.message?.content;
  if (!text) throw new Error("Ollama response did not include resume JSON.");
  return text;
}

export async function requestStructuredJson({ config, schemaName, systemPrompt, userPrompt }) {
  if (config.provider === "openai") {
    return requestOpenAiStructuredJson({ config, schemaName, systemPrompt, userPrompt });
  }
  return requestOllamaStructuredJson({ config, systemPrompt, userPrompt });
}
