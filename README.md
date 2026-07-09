# AI Resume Tailor

Astro + Vue app for tailoring resumes to job descriptions with AI.

## Stack

- [Astro](https://docs.astro.build) — server-first site framework
- [Vue 3](https://vuejs.org) — interactive islands
- [Bun](https://bun.sh) — runtime and package manager
- TypeScript — strict mode
- [Google Gemini](https://ai.google.dev) — resume tailoring
- [Vitest](https://vitest.dev) — unit and integration tests
- [Zod](https://zod.dev) — runtime validation

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

1. Upload a resume (PDF, DOCX, or TXT, up to 8 MB)
2. Paste a job description **or a vacancy URL** (LinkedIn, Djinni, careers page, etc.)
3. Submit the form — the app calls `POST /api/tailor-resume`
4. If a URL was provided, the server fetches the page and extracts the job text
5. Gemini returns a tailored resume — preview on screen, download as PDF

## Supported file formats

| Format | Extension | Max size |
| ------ | --------- | -------- |
| PDF    | `.pdf`    | 8 MB     |
| Word   | `.docx`   | 8 MB     |
| Text   | `.txt`    | 8 MB     |

Uploads are validated by extension, MIME type, and file signature (magic bytes).

## Environment variables

| Variable             | Required | Description                                                         |
| -------------------- | -------- | ------------------------------------------------------------------- |
| `GEMINI_API_KEY`     | Yes      | API key from [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL`       | No       | Model id (default `gemini-2.0-flash`)                               |
| `GEMINI_PROMPT`      | No       | Full prompt text; overrides the file                                |
| `GEMINI_PROMPT_PATH` | No       | Path to prompt file (default `prompts/tailor-resume.prompt`)        |

See `.env.example` for details.

## Scripts

| Command                | Description                       |
| ---------------------- | --------------------------------- |
| `bun run dev`          | Start dev server                  |
| `bun run setup`        | Create `.env` from `.env.example` |
| `bun run build`        | Production build                  |
| `bun run preview`      | Preview production build          |
| `bun run check`        | Type-check Astro and Vue files    |
| `bun run lint`         | Run ESLint                        |
| `bun run format`       | Format code with Prettier         |
| `bun run format:check` | Check formatting                  |
| `bun run test`         | Run tests once                    |
| `bun run test:watch`   | Run tests in watch mode           |

## Security notes

- **SSRF protection** — job URL fetching blocks localhost, private/link-local IP ranges, and non-HTTP(S) protocols. Redirect targets are validated the same way.
- **File validation** — resume uploads are limited to 8 MB and checked by extension, MIME type, and magic bytes.
- **Error handling** — unexpected server errors return a generic message; technical details are logged server-side only.
- **No persistence** — resumes are processed in memory for tailoring and are not stored unless you explicitly download the result.
- **API key** — keep `GEMINI_API_KEY` in server-side env vars only (never expose it to the client).

## Production readiness

This MVP includes:

- SSRF-safe URL fetching with redirect validation
- Upload validation (size, MIME, magic bytes)
- Structured Gemini response validation via Zod
- Cheerio-based HTML extraction for job pages
- Vitest coverage for core validation and API behavior
- ESLint, Prettier, and GitHub Actions CI (typecheck, lint, test, build)

Before going live, verify your Vercel plan supports the API route duration you need and set production env vars.

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Vercel detects Astro + Bun (`bun.lock`). Build command: `bun run build`.
4. Add **Environment Variables** (Production + Preview):
   - `GEMINI_API_KEY` — required
   - `GEMINI_MODEL` — optional (default `gemini-2.0-flash`; avoid slow models on Hobby/10s limit)
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
    url-validation.ts   # SSRF protection for URL fetching
    file-validation.ts  # Upload size/MIME/signature checks
    schemas.ts          # Zod schemas
  pages/        # Routes and API endpoints
  styles/       # Global CSS
  types/        # Shared TypeScript types
tests/          # Integration tests
public/         # Static assets
```
