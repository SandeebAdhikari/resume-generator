export async function reviseAiResumeSchema({ resume, jobDescription, analysis, blueprint, generationRules, instruction }) {
  const response = await fetch("/api/revise-resume", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      resume,
      jobDescription,
      analysis,
      blueprint,
      generationRules,
      instruction
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "AI resume revision failed.");
  }

  return payload;
}
