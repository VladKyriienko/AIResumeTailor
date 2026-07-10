import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    {
      name: 'astro-env-server-mock',
      resolveId(source) {
        if (source === 'astro:env/server') {
          return '\0astro:env/server';
        }
      },
      load(id) {
        if (id === '\0astro:env/server') {
          return `
            export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
            export const GEMINI_MODEL = process.env.GEMINI_MODEL;
            export const GEMINI_PROMPT = process.env.GEMINI_PROMPT;
            export const GEMINI_PROMPT_PATH = process.env.GEMINI_PROMPT_PATH;
            export const GOOGLE_DOCS_DOCUMENT_ID = process.env.GOOGLE_DOCS_DOCUMENT_ID;
            export const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
            export const GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
          `;
        }
      },
    },
    {
      name: 'raw-import-mock',
      resolveId(source) {
        if (source.endsWith('?raw')) {
          return '\0' + source;
        }
      },
      load(id) {
        if (id.startsWith('\0') && id.endsWith('?raw')) {
          return 'export default "";';
        }
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
});
