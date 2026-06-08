# Resume Tailor

Local static app for creating an ideal-candidate resume benchmark from a pasted job description.

## Run

Serve the app with the local Node server so the browser can call the AI endpoint without exposing your API key:

Create `app/.env`:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
PORT=8787
```

Then start the server:

```bash
cd app
npm start
```

Then visit `http://127.0.0.1:8787`.

Optional:

```bash
OPENAI_MODEL=gpt-4.1-mini OPENAI_API_KEY=your_key npm start
```

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
-> OpenAI structured-output resume generation
-> resume renderer
-> browser PDF export
```

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

The AI call receives only:

- the full JD
- the JD analysis
- the selected layout blueprint
- the selected level generation rules
- the required output schema

The API key stays on the local Node server. The browser never stores it. The JD is sent to the configured OpenAI model when you click **Generate Resume**.
