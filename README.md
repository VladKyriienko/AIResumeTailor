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

Add your Gemini API key and Google Docs prompt settings to `.env` (see [Prompt from Google Docs](#prompt-from-google-docs)).

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

The Gemini prompt is loaded from a **Google Doc** at runtime. The document must include `{{JOB_DESCRIPTION}}` and `{{RESUME_TEXT}}` placeholders. Optionally set `GEMINI_PROMPT` in env as an emergency override.

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

Uploads are validated by extension, MIME type, file signature (magic bytes), and for DOCX an internal ZIP structure check (`[Content_Types].xml`, `word/document.xml`).

## Environment variables

| Variable         | Required | Description                                                         |
| ---------------- | -------- | ------------------------------------------------------------------- |
| `GEMINI_API_KEY` | Yes      | API key from [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL`   | No       | Model id (default `gemini-2.0-flash`)                               |
| `GEMINI_PROMPT`  | No       | Emergency prompt override; skips Google Docs                        |

See `.env.example` for details.

### Prompt from Google Docs

The Gemini prompt is loaded from a Google Doc so it can be edited without redeploying the app. Priority order:

1. `GEMINI_PROMPT` — emergency override (highest priority)
2. Google Docs document

The document must include `{{JOB_DESCRIPTION}}` and `{{RESUME_TEXT}}` placeholders.

#### 1. Enable Google Docs API

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project (or create one).
3. Go to **APIs & Services → Library**.
4. Search for **Google Docs API** and click **Enable**.

#### 2. Create a service account

1. Go to **APIs & Services → Credentials**.
2. Click **Create credentials → Service account**.
3. Create the account and open it → **Keys → Add key → Create new key → JSON**.
4. Save the JSON file locally — **do not commit it to git**.
5. From the JSON, copy:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (paste as one line; `\n` escapes are supported)

#### 3. Share the Google Doc

1. Open your document in Google Docs.
2. Click **Share**.
3. Add the service account email (`...@...iam.gserviceaccount.com`) as **Viewer**.

#### 4. Find the document ID

From the document URL:

`https://docs.google.com/document/d/DOCUMENT_ID/edit`

Copy the `DOCUMENT_ID` segment into `GOOGLE_DOCS_DOCUMENT_ID`.

#### 5. Configure environment variables

Add to `.env` locally or in Vercel (**Environment Variables** for Production + Preview):

| Variable                             | Description                                           |
| ------------------------------------ | ----------------------------------------------------- |
| `GOOGLE_DOCS_DOCUMENT_ID`            | Document ID from the URL                              |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`       | Service account `client_email`                        |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Service account `private_key` (supports escaped `\n`) |

`GEMINI_PROMPT` still wins if set — useful for a quick override without changing the document.

## Scripts

| Command                  | Description                       |
| ------------------------ | --------------------------------- |
| `bun run dev`            | Start dev server                  |
| `bun run setup`          | Create `.env` from `.env.example` |
| `bun run build`          | Production build                  |
| `bun run preview`        | Preview production build          |
| `bun run check`          | Type-check Astro and Vue files    |
| `bun run typecheck:test` | Type-check test files             |
| `bun run lint`           | Run ESLint                        |
| `bun run format`         | Format code with Prettier         |
| `bun run format:check`   | Check formatting                  |
| `bun run test`           | Run tests once                    |
| `bun run test:watch`     | Run tests in watch mode           |

## Security and production notes

### File uploads

- Supported formats: PDF, DOCX, TXT
- Maximum size: **8 MB**
- DOCX files must be real Word documents, not arbitrary ZIP archives

### Vacancy URL fetching

Job URLs are fetched server-side with multiple safeguards:

- **Protocol allowlist** — only `http:` and `https:`
- **IP blocking** — localhost, private, link-local, metadata, and IPv4-mapped IPv6 ranges
- **Redirect validation** — every redirect target is re-checked
- **Domain allowlist** — only popular job/careers platforms are allowed:
  LinkedIn, Djinni, DOU, Indeed, Glassdoor, Greenhouse, Lever, Workday, SmartRecruiters, Workable, Ashby

If a vacancy URL is not on the allowlist, the app returns:

> This URL cannot be loaded. Paste the job description manually.

Paste the job description text directly when a careers page is hosted on a company domain that is not listed above.

**DNS rebinding:** allowlisted domains still go through DNS resolution with post-resolve IP checks. For stricter production hardening, consider pinned DNS resolution or a custom HTTP agent with a fixed resolver.

### Other safeguards

- Unexpected server errors return a generic message; technical details are logged server-side only
- Resumes are processed in memory and are not stored server-side
- Keep `GEMINI_API_KEY` in server-side environment variables only

## Production readiness

This MVP includes:

- SSRF-safe URL fetching with redirect validation and domain allowlist
- Upload validation (size, MIME, magic bytes, DOCX ZIP structure)
- Structured Gemini response validation via Zod
- Cheerio-based HTML extraction for job pages
- Vitest coverage for core validation and API behavior
- ESLint, Prettier, and GitHub Actions CI (`check`, `typecheck:test`, lint, test, build)

Before going live, verify your Vercel plan supports the API route duration you need and set production env vars.

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Vercel detects Astro + Bun (`bun.lock`). Build command: `bun run build`.
4. Add **Environment Variables** (Production + Preview):
   - `GEMINI_API_KEY` — required
   - `GEMINI_MODEL` — optional (default `gemini-2.0-flash`; avoid slow models on Hobby/10s limit)
   - `GEMINI_PROMPT` — optional emergency override
   - `GOOGLE_DOCS_DOCUMENT_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — required for prompt loading (see [Prompt from Google Docs](#prompt-from-google-docs))
5. Deploy.

The app uses `@astrojs/vercel` with `maxDuration: 60` for the tailor API (requires Vercel Pro for 60s; Hobby limit is 10s).

## Project structure

```
src/
  components/   # Vue islands
  layouts/      # Page layouts
  lib/
    gemini.ts           # Gemini API + env + prompt loading
    google-docs.ts      # Google Docs prompt source
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
