export function getAiConfig(env = process.env) {
  let provider = String(env.AI_PROVIDER || "ollama").toLowerCase();
  const openAiApiKey = String(env.OPENAI_API_KEY || "").trim();

  if (provider === "openai" && !openAiApiKey) {
    console.warn("AI_PROVIDER=openai but OPENAI_API_KEY is missing. Falling back to Ollama.");
    provider = "ollama";
  }

  if (provider === "openai") {
    return {
      provider: "openai",
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      baseUrl: "https://api.openai.com",
      openAiApiKey
    };
  }

  return {
    provider: "ollama",
    model: env.OLLAMA_MODEL || env.OPENAI_MODEL || "qwen3:8b",
    baseUrl: String(env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, ""),
    numCtx: Number(env.OLLAMA_NUM_CTX || 8192),
    numPredict: Number(env.OLLAMA_NUM_PREDICT || 6000)
  };
}

export function getAiConfigError(config, env = process.env) {
  if (config.provider === "openai" && !String(env.OPENAI_API_KEY || "").trim()) {
    return "OPENAI_API_KEY is not set. Add it to app/.env or set AI_PROVIDER=ollama to use a local Ollama model.";
  }
  return "";
}
