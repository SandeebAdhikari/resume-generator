# Resume Tailor

Local static app for creating an ideal-candidate resume benchmark from a pasted job description.

## Run

Serve the app with the local Node server so the browser can call the AI endpoint without exposing credentials.

### Option A: Ollama (default, local, no API key)

#### A1. Native Ollama app (recommended on Mac)

Uses Apple Silicon GPU — usually **much faster** than Docker Ollama.

1. **Stop Docker Ollama** if it is running (only one can use port `11434`):

```bash
cd ~/Desktop/resume
docker compose stop ollama
```

2. Open the **Ollama** app from Applications (menu bar icon).
   - You do **not** need `ollama serve` if the app is already running.
   - If `ollama serve` says `address already in use`, Ollama is already up.

3. Verify and pull the model:

```bash
ollama list
ollama pull llama3:latest
```

4. Use `app/.env` (already set for native):

```bash
AI_PROVIDER=ollama
OLLAMA_MODEL=llama3:latest
OLLAMA_BASE_URL=http://127.0.0.1:11434
PORT=8787
```

5. Start the app:

```bash
cd app
npm start
```

Then visit `http://127.0.0.1:8787`.

On startup you should see:

```text
AI provider: ollama (llama3:latest)
```

#### A2. Ollama in Docker (optional, kept for later)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/). Slower on Mac (CPU-only) but useful for a portable setup.

Run all `docker compose` commands from the **repo root** (`resume/`), not from `app/`.

1. Quit the **native Ollama app** first. Docker and native both use port `11434`.

2. From the repo root:

```bash
./scripts/ollama-docker.sh
```

Or manually:

```bash
docker compose up -d
docker compose exec ollama ollama pull llama3:latest
```

3. Verify Docker Ollama:

```bash
docker compose ps
docker compose exec ollama ollama list
curl http://127.0.0.1:11434/api/tags
```

4. Same `app/.env` as native — `OLLAMA_BASE_URL=http://127.0.0.1:11434` works for both.

Useful Docker commands:

```bash
docker compose ps
docker compose exec ollama ollama list
docker compose stop          # stop container, keep models in volume
docker compose down
docker compose logs -f ollama
```

Models persist in the `ollama_data` Docker volume.

### Option B: OpenAI

Create `app/.env`:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
PORT=8787
```

Then start the server with `npm start` as above.

## Configuration

All settings live in `app/.env`. See `app/.env.example` for the full template.

| Variable | Default | Used when | Description |
| --- | --- | --- | --- |
| `AI_PROVIDER` | `ollama` | always | `ollama` for local models, `openai` for cloud |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | `AI_PROVIDER=ollama` | Local Ollama API URL |
| `OLLAMA_MODEL` | `llama3:latest` | `AI_PROVIDER=ollama` | Model name from `ollama list` |
| `OLLAMA_NUM_CTX` | `16384` | `AI_PROVIDER=ollama` | Context window size for long JDs and resumes |
| `OLLAMA_NUM_PREDICT` | `12000` | `AI_PROVIDER=ollama` | Max output tokens for full resume JSON |
| `OPENAI_API_KEY` | — | `AI_PROVIDER=openai` | Required for OpenAI |
| `OPENAI_MODEL` | `gpt-4.1-mini` | `AI_PROVIDER=openai` | OpenAI model name |
| `PORT` | `8787` | always | Local server port |

### Model recommendations

**Default: `llama3:latest`** — best balance of quality and speed for this app. It follows structured JSON instructions and long resume rules better than `mistral:latest` or `llama3.2`.

| Model | Best for |
| --- | --- |
| `llama3:latest` | **Recommended.** Stronger resume quality and better rule-following |
| `mistral:latest` | Alternative if you prefer Mistral-style writing |
| `llama3.2` | Faster, lighter, but weaker for long structured resumes |

With Docker, models live inside the container volume. Check with:

```bash
docker compose exec ollama ollama list
```

Restart the app server after changing `.env`:

```bash
OLLAMA_MODEL=llama3:latest
```

### Ollama troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `address already in use` on `ollama serve` | Native Ollama is already running | Skip `ollama serve`; use `ollama list` to confirm |
| `Port 11434 is already in use` from Docker script | Native Ollama still running | Quit the Ollama app, then run `./scripts/ollama-docker.sh` again |
| `401 Unauthorized` / invalid OpenAI API key | App is using OpenAI with a bad or expired key | Set `AI_PROVIDER=ollama` in `app/.env`, remove `OPENAI_API_KEY`, restart `npm start` |
| Connection refused / Ollama API failed | Ollama not running | Run `docker compose up -d` or open the native Ollama app |
| `model not found` | Model not pulled in Docker | Run `docker compose exec ollama ollama pull llama3:latest` |
| Resume JSON incomplete or truncated | Output too long for model limits | Raise `OLLAMA_NUM_PREDICT` or use a larger model |
| Weak or generic resume content | Model too small | Use `llama3:latest` (recommended over `mistral:latest` for this app) |
| Docker Ollama is slow | CPU-only inference in Docker on Mac | Use **native Ollama app** (recommended) or `docker compose stop ollama` before opening native |

## Use

1. Paste the full job description.
2. Pick the resume level, or leave it on **Auto-detect from JD**.
3. Click **Generate Resume**.
4. Ask for a section revision when needed, for example: `Add more AWS and Kafka skills to the second experience`.
5. Edit the preview directly for small manual changes.
6. Click **Export PDF** and choose **Save as PDF** in the print dialog.

## Pipeline

```text
JD input
-> JD analyzer
-> level classifier
-> layout blueprint loader
-> level generation rules loader
-> local backend `/api/generate-resume`
-> Ollama (Docker or native) or OpenAI structured-output resume generation
-> resume renderer
-> browser PDF export
```

Docker files:

- `docker-compose.yml` — Ollama service
- `scripts/ollama-docker.sh` — start Ollama, wait for health, pull default model

## Revision Flow

After a resume is generated, the browser keeps the current resume JSON, JD analysis, layout blueprint, and level rules. A revision request is sent to `/api/revise-resume`.

Header and education changes are handled without AI because they are factual user-provided sections:

- Header fields: name, phone, email, location, portfolio, LinkedIn
- Education fields: school, degree, major, location, graduation date, GPA, coursework, certifications

If the user asks to fill header or education but leaves required information missing, the backend returns `needs_input` with the missing fields instead of guessing.

AI is used for content-heavy sections:

- Professional summary
- Skills
- Work experience
- Projects

The backend sends the current resume JSON, the requested section, the user instruction, the JD, JD analysis, layout blueprint, and level rules. The AI must return the full resume JSON, preserve unrequested sections, and preserve header and education.

`app/layouts/*.json` controls layout and writing rules. The original resume files under `app/assets/reference-resumes/` are archived layout references.

`app/rules/resume-level-rules.json` controls how much content the AI should generate for each level: number of experience entries, project count, bullet count, skill breadth, environment breadth, date placeholders, and level-appropriate writing style.

There is no candidate-profile path right now. The current app is intentionally focused only on the ideal-candidate benchmark flow. A tailored-resume mode can be added later as a separate feature.

The AI call receives:

- the full JD
- the JD analysis
- the selected layout blueprint
- the selected level generation rules
- the required output schema

AI calls stay on the local Node server. The browser never stores API keys. The JD is sent to the configured Ollama or OpenAI model when you click **Generate Resume**.

## Backend Architecture

```text
app.js
  -> jd-analyzer.js
  -> layout-loader.js + rules-loader.js
  -> ai-resume-client.js / ai-revision-client.js
  -> server.mjs (HTTP only)
      -> ai-service.js (generate + revise orchestration)
          -> ai-config.js (provider selection)
          -> ai-prompts.js (prompt building)
          -> ai-providers.js (OpenAI / Ollama API calls)
          -> resume-normalizer.js (post-processing)
      -> revision-handlers.js (header + education without AI)
  -> resume-renderer.js
```

Shared resume content helpers live in `app/core/resume-content.js` and are reused by the local fallback generator, AI post-processing, and prompt building.

## AI Prompts

Prompt construction lives in `app/core/ai-prompts.js`. The backend uses provider-specific prompts because local Ollama models usually need more explicit instructions than OpenAI models.

### Shared rules

Both providers receive the same core constraints:

- content comes from the JD and JD analysis only
- layout blueprints control structure and writing style, not factual content
- level rules control experience count, project count, bullet count, skills, and date ranges
- output must be a single resume JSON object matching `app/core/resume-schema.js`

### Ollama-specific prompt enhancements

When `AI_PROVIDER=ollama`, the backend uses a different prompt strategy than OpenAI because local models follow readable instructions better than one giant nested JSON blob.

Ollama receives:

- a readable multi-section user prompt instead of a huge JSON payload
- extracted `writingBrief` from the layout blueprint (summary tone, bullet pattern, verbs, avoid list)
- explicit JD responsibilities rewritten into resume bullets
- a flattened `levelChecklist` with exact counts, skills, date ranges, and writing tone
- an `outputShape` example showing the expected JSON structure
- strict output rules: raw JSON only, no markdown fences, no commentary
- larger context/output limits via `OLLAMA_NUM_CTX` and `OLLAMA_NUM_PREDICT`

Post-processing was also adjusted so Ollama-generated environment lines and bullets are preserved instead of being replaced with generic filler when possible.

### OpenAI path

When `AI_PROVIDER=openai`, the backend uses the shorter prompt style and OpenAI's `/v1/responses` API with strict JSON schema output.

### Post-processing

Regardless of provider, `app/server.mjs` normalizes the AI response before rendering:

- fills missing experience/project entries to match level rules
- enforces date ranges and skill group counts
- keeps header generic unless the user edits it directly
- preserves header and education during AI revisions
