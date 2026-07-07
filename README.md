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

This creates `.env` and `prompts/tailor-resume.prompt` from examples (skips if they already exist).

Add your Gemini API key to `.env`:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

Edit `prompts/tailor-resume.prompt` locally — this file is **gitignored** and will not be pushed to GitHub. Use `{{JOB_DESCRIPTION}}` and `{{RESUME_TEXT}}` placeholders where dynamic content should be inserted.

For production (e.g. Vercel), you can set the full prompt via the `GEMINI_PROMPT` environment variable instead of a file. `GEMINI_PROMPT` takes priority over `GEMINI_PROMPT_PATH`.

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

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `bun run dev`       | Start dev server                             |
| `bun run setup`     | Create `.env` and local prompt from examples |
| `bun run setup:env` | Create `.env` only                           |
| `bun run build`     | Production build                             |
| `bun run preview`   | Preview production build                     |
| `bun run check`     | Type-check Astro and Vue files               |

## Project structure

```
prompts/
  tailor-resume.prompt.example  # template committed to git
  tailor-resume.prompt          # local prompt (gitignored)
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
