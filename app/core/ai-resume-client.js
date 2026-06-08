export async function generateAiResumeSchema({ jobDescription, analysis, blueprint, generationRules }) {
  const response = await fetch("/api/generate-resume", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      jobDescription,
      analysis,
      blueprint,
      generationRules
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "AI resume generation failed.");
  }

  return payload.resume;
}
