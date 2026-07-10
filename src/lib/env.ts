import {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_PROMPT,
  GOOGLE_DOCS_DOCUMENT_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
} from 'astro:env/server';

function emptyToUndefined(value: string | undefined): string | undefined {
  return value === '' ? undefined : value;
}

export function readServerEnv(name: string): string | undefined {
  switch (name) {
    case 'GEMINI_API_KEY':
      return (
        emptyToUndefined(GEMINI_API_KEY) ??
        emptyToUndefined(process.env.GEMINI_API_KEY)
      );
    case 'GEMINI_MODEL':
      return (
        emptyToUndefined(GEMINI_MODEL) ??
        emptyToUndefined(process.env.GEMINI_MODEL)
      );
    case 'GEMINI_PROMPT':
      return (
        emptyToUndefined(GEMINI_PROMPT) ??
        emptyToUndefined(process.env.GEMINI_PROMPT)
      );
    case 'GOOGLE_DOCS_DOCUMENT_ID':
      return (
        emptyToUndefined(GOOGLE_DOCS_DOCUMENT_ID) ??
        emptyToUndefined(process.env.GOOGLE_DOCS_DOCUMENT_ID)
      );
    case 'GOOGLE_SERVICE_ACCOUNT_EMAIL':
      return (
        emptyToUndefined(GOOGLE_SERVICE_ACCOUNT_EMAIL) ??
        emptyToUndefined(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
      );
    case 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY':
      return (
        emptyToUndefined(GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) ??
        emptyToUndefined(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
      );
    default:
      return emptyToUndefined(process.env[name]);
  }
}
