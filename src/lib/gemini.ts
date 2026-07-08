import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import {
  GoogleGenerativeAI,
  SchemaType,
  type ResponseSchema,
} from '@google/generative-ai';
import type { TailorResult } from '@/types';
import bundledPrompt from '../../prompts/tailor-resume.prompt?raw';

const PLACEHOLDER_API_KEY = 'your_gemini_api_key_here';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
const DEFAULT_PROMPT_FILE = 'prompts/tailor-resume.prompt';
const JOB_DESCRIPTION_PLACEHOLDER = '{{JOB_DESCRIPTION}}';
const RESUME_TEXT_PLACEHOLDER = '{{RESUME_TEXT}}';

const TAILOR_RESULT_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    tailoredResume: {
      type: SchemaType.STRING,
      description: 'Full tailored resume in markdown',
    },
  },
  required: ['tailoredResume'],
};

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiConfigError';
  }
}

export class GeminiApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GeminiApiError';
    this.status = status;
  }
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === '' ? undefined : value;
}

function getGeminiApiKey(): string {
  const apiKey = readEnv('GEMINI_API_KEY');

  if (!apiKey || apiKey === PLACEHOLDER_API_KEY) {
    throw new GeminiConfigError(
      'GEMINI_API_KEY is missing. Add it to .env and restart the dev server.',
    );
  }

  return apiKey;
}

function getGeminiModel(
  fallback = DEFAULT_GEMINI_MODEL,
): string {
  return readEnv('GEMINI_MODEL') ?? fallback;
}

function resolvePromptPath(): string {
  const configuredPath = readEnv('GEMINI_PROMPT_PATH');

  if (configuredPath) {
    return isAbsolute(configuredPath)
      ? configuredPath
      : join(process.cwd(), configuredPath);
  }

  return join(process.cwd(), DEFAULT_PROMPT_FILE);
}

function validatePromptTemplate(template: string): void {
  if (
    !template.includes(JOB_DESCRIPTION_PLACEHOLDER) ||
    !template.includes(RESUME_TEXT_PLACEHOLDER)
  ) {
    throw new GeminiConfigError(
      'Prompt must include {{JOB_DESCRIPTION}} and {{RESUME_TEXT}} placeholders.',
    );
  }
}

function fillPromptTemplate(
  template: string,
  jobDescription: string,
  resumeText: string,
): string {
  return template
    .replaceAll(JOB_DESCRIPTION_PLACEHOLDER, jobDescription)
    .replaceAll(RESUME_TEXT_PLACEHOLDER, resumeText);
}

async function loadPromptTemplate(): Promise<string> {
  const fromEnv = readEnv('GEMINI_PROMPT')?.trim();
  if (fromEnv) return fromEnv;

  const promptPath = resolvePromptPath();

  try {
    return await readFile(promptPath, 'utf-8');
  } catch {
    if (bundledPrompt.trim()) {
      return bundledPrompt;
    }

    throw new GeminiConfigError(
      `Prompt not found at ${promptPath}. Set GEMINI_PROMPT in env or create the prompt file.`,
    );
  }
}

async function loadTailorPrompt(
  jobDescription: string,
  resumeText: string,
): Promise<string> {
  const template = await loadPromptTemplate();
  validatePromptTemplate(template);
  return fillPromptTemplate(
    template,
    jobDescription,
    resumeText,
  );
}

function getRetrySeconds(message: string): number | null {
  const match = message.match(/retry in ([\d.]+)s/i);
  return match
    ? Math.ceil(Number.parseFloat(match[1]))
    : null;
}

function toGeminiApiError(error: unknown): GeminiApiError {
  if (error instanceof GeminiApiError) return error;

  const message =
    error instanceof Error ? error.message : String(error);
  const status =
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number'
      ? error.status
      : 500;

  if (status === 429 || message.includes('quota')) {
    const retrySeconds = getRetrySeconds(message);
    return new GeminiApiError(
      [
        'Gemini API quota exceeded for your current plan.',
        retrySeconds
          ? `Try again in about ${retrySeconds} seconds.`
          : 'Try again later.',
        'You can also set GEMINI_MODEL=gemini-2.0-flash in .env or enable billing in Google AI Studio.',
      ].join(' '),
      429,
    );
  }

  if (message.includes('unexpected model name format')) {
    return new GeminiApiError(
      'Invalid GEMINI_MODEL in .env. Use an API model id like gemini-3.5-flash.',
      400,
    );
  }

  if (status === 403) {
    return new GeminiApiError(
      'Gemini API access denied. Verify your API key and project permissions.',
      403,
    );
  }

  return new GeminiApiError(
    'Gemini request failed. Check your API key, model name, and quota.',
    status,
  );
}

function getGeminiClientModel() {
  const apiKey = getGeminiApiKey();
  const modelName = getGeminiModel();
  const client = new GoogleGenerativeAI(apiKey);

  return client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: TAILOR_RESULT_SCHEMA,
      temperature: 0.4,
    },
  });
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(
    /^```(?:json)?\s*([\s\S]*?)\s*```$/i,
  );
  return match?.[1]?.trim() ?? trimmed;
}

function unescapeJsonString(value: string): string {
  return value.replace(
    /\\(["\\/bfnrt]|u[0-9a-fA-F]{4})/g,
    (_match, sequence: string) => {
      switch (sequence) {
        case '"':
          return '"';
        case '\\':
          return '\\';
        case '/':
          return '/';
        case 'b':
          return '\b';
        case 'f':
          return '\f';
        case 'n':
          return '\n';
        case 'r':
          return '\r';
        case 't':
          return '\t';
        default: {
          const codePoint = Number.parseInt(
            sequence.slice(1),
            16,
          );
          return String.fromCharCode(codePoint);
        }
      }
    },
  );
}

function extractTailoredResumeLenient(
  rawText: string,
): string | null {
  const cleaned = stripJsonFence(rawText);
  const match = cleaned.match(/"tailoredResume"\s*:\s*"/);
  if (!match?.index) return null;

  const contentStart = match.index + match[0].length;
  const closingQuote = cleaned.lastIndexOf('"');
  if (closingQuote <= contentStart) return null;

  const afterValue = cleaned.slice(closingQuote + 1).trim();
  if (!afterValue.startsWith('}')) return null;

  return unescapeJsonString(
    cleaned.slice(contentStart, closingQuote),
  );
}

function parseTailorResult(rawText: string): TailorResult {
  const cleaned = stripJsonFence(rawText);

  let tailoredResume: string | undefined;

  try {
    const parsed = JSON.parse(
      cleaned,
    ) as Partial<TailorResult>;
    tailoredResume = parsed.tailoredResume;
  } catch {
    tailoredResume =
      extractTailoredResumeLenient(cleaned) ?? undefined;
  }

  if (
    typeof tailoredResume !== 'string' ||
    !tailoredResume.trim()
  ) {
    throw new GeminiApiError(
      'Gemini returned an invalid response. Try again.',
      502,
    );
  }

  return { tailoredResume: tailoredResume.trim() };
}

export async function tailorResumeWithGemini(
  resumeText: string,
  jobDescription: string,
): Promise<TailorResult> {
  const model = getGeminiClientModel();
  const prompt = await loadTailorPrompt(
    jobDescription,
    resumeText,
  );

  let rawText: string;

  try {
    const result = await model.generateContent(prompt);
    rawText = result.response.text();
  } catch (error) {
    if (error instanceof GeminiConfigError) throw error;
    throw toGeminiApiError(error);
  }

  if (!rawText) {
    throw new Error('Gemini returned an empty response.');
  }

  try {
    return parseTailorResult(rawText);
  } catch (error) {
    if (error instanceof GeminiApiError) throw error;
    throw new GeminiApiError(
      'Gemini returned an invalid response. Try again.',
      502,
    );
  }
}
