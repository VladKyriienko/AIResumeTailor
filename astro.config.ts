import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import vue from '@astrojs/vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  adapter: vercel({
    maxDuration: 60,
  }),
  integrations: [vue()],
  env: {
    schema: {
      GEMINI_API_KEY: envField.string({
        context: 'server',
        access: 'secret',
      }),
      GEMINI_MODEL: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      GEMINI_PROMPT_PATH: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      GEMINI_PROMPT: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
    },
    validateSecrets: true,
  },
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(
          new URL('./src', import.meta.url),
        ),
      },
    },
  },
});
