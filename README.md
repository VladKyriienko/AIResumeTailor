# AI Resume Tailor

Astro + Vue app for tailoring resumes to job descriptions with AI.

## Stack

- [Astro](https://docs.astro.build) — server-first site framework
- [Vue 3](https://vuejs.org) — interactive islands
- [Bun](https://bun.sh) — runtime and package manager
- TypeScript — strict mode
- [Google Gemini](https://ai.google.dev) — resume tailoring

## Getting started

```bash
bun install
bun run setup
```

This creates `.env` from `.env.example` (skips if it already exists).

Add your Gemini API key to `.env`:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

The prompt lives in `prompts/tailor-resume.prompt` (committed to git). Edit it locally and use `{{JOB_DESCRIPTION}}` and `{{RESUME_TEXT}}` placeholders where dynamic content should be inserted.

For production (e.g. Vercel), you can override the file via the `GEMINI_PROMPT` environment variable. `GEMINI_PROMPT` takes priority over `GEMINI_PROMPT_PATH`.

Start the dev server:

```bash
bun run dev
```

Open [http://localhost:4321](http://localhost:4321).

## How it works

1. Upload a resume (PDF, DOCX, or TXT)
2. Paste a job description **or a vacancy URL** (LinkedIn, Djinni, careers page, etc.)
3. Submit the form — the app calls `POST /api/tailor-resume`
4. If a URL was provided, the server fetches the page and extracts the job text
5. Gemini returns a tailored resume — preview on screen, download as PDF

## Scripts

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `bun run dev`       | Start dev server                  |
| `bun run setup`     | Create `.env` from `.env.example` |
| `bun run setup:env` | Create `.env` only                |
| `bun run build`     | Production build                  |
| `bun run preview`   | Preview production build          |
| `bun run check`     | Type-check Astro and Vue files    |

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Vercel detects Astro + Bun (`bun.lock`). Build command: `bun run build`.
4. Add **Environment Variables** (Production + Preview):
   - `GEMINI_API_KEY` — required
   - `GEMINI_MODEL` — optional (default `gemini-3.5-flash`)
   - `GEMINI_PROMPT` — optional; overrides `prompts/tailor-resume.prompt`
5. Deploy.

The app uses `@astrojs/vercel` with `maxDuration: 60` for the tailor API (requires Vercel Pro for 60s; Hobby limit is 10s).

## Project structure

```
prompts/
  tailor-resume.prompt  # Gemini prompt (committed to git)
src/
  components/   # Vue islands
  layouts/      # Page layouts
  lib/
    gemini.ts           # Gemini API + env + prompt loading
    resume.ts           # Resume extraction + PDF export
    job-description.ts  # URL detection + job text fetching
  pages/        # Routes and API endpoints
  styles/       # Global CSS
  types/        # Shared TypeScript types
public/         # Static assets
```
