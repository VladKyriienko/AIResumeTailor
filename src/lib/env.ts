import {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_PROMPT,
  GEMINI_PROMPT_PATH,
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
    case 'GEMINI_PROMPT_PATH':
      return (
        emptyToUndefined(GEMINI_PROMPT_PATH) ??
        emptyToUndefined(process.env.GEMINI_PROMPT_PATH)
      );
    default:
      return emptyToUndefined(process.env[name]);
  }
}
