import { google } from 'googleapis';
import { readServerEnv } from '@/lib/env';

const DOCS_READONLY_SCOPE =
  'https://www.googleapis.com/auth/documents.readonly';
const PRODUCTION_SUCCESS_CACHE_TTL_MS = 5 * 60 * 1000;
const DEVELOPMENT_SUCCESS_CACHE_TTL_MS = 30 * 1000;
const MISS_CACHE_TTL_MS = 30 * 1000;

function getSuccessCacheTtlMs(): number {
  if (import.meta.env.DEV) {
    return DEVELOPMENT_SUCCESS_CACHE_TTL_MS;
  }

  return PRODUCTION_SUCCESS_CACHE_TTL_MS;
}

type DocsTextRun = {
  content?: string | null;
};

type DocsParagraphElement = {
  textRun?: DocsTextRun | null;
};

type DocsParagraph = {
  elements?: DocsParagraphElement[] | null;
};

type DocsStructuralElement = {
  paragraph?: DocsParagraph | null;
};

type PromptCacheEntry = {
  value: string;
  expiresAt: number;
};

type MissCacheEntry = {
  expiresAt: number;
};

let successCache: PromptCacheEntry | null = null;
let missCache: MissCacheEntry | null = null;
let lastSuccessfulPrompt: string | null = null;

export function formatServiceAccountPrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n');
}

export function resetGoogleDocsPromptCacheForTests(): void {
  successCache = null;
  missCache = null;
  lastSuccessfulPrompt = null;
}

export function extractPromptTextFromDocBody(body: {
  content?: DocsStructuralElement[] | null;
}): string {
  const parts: string[] = [];

  for (const element of body.content ?? []) {
    const paragraph = element.paragraph;
    if (!paragraph?.elements) continue;

    for (const el of paragraph.elements) {
      const content = el.textRun?.content;
      if (content) parts.push(content);
    }
  }

  return parts.join('').trim();
}

function getGoogleDocsConfig(): {
  documentId: string;
  email: string;
  privateKey: string;
} | null {
  const documentId = readServerEnv('GOOGLE_DOCS_DOCUMENT_ID');
  const email = readServerEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKeyRaw = readServerEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');

  if (!documentId || !email || !privateKeyRaw) {
    return null;
  }

  return {
    documentId: documentId.trim(),
    email: email.trim(),
    privateKey: formatServiceAccountPrivateKey(privateKeyRaw.trim()),
  };
}

function formatDocsFetchError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const status =
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'status' in error.response &&
    typeof error.response.status === 'number'
      ? error.response.status
      : undefined;

  if (status === 404 || message.toLowerCase().includes('not found')) {
    return [
      message,
      'Verify GOOGLE_DOCS_DOCUMENT_ID and share the document with',
      'GOOGLE_SERVICE_ACCOUNT_EMAIL as Viewer.',
    ].join(' ');
  }

  return message;
}

function readCachedPrompt(now: number): string | null | undefined {
  if (successCache && successCache.expiresAt > now) {
    return successCache.value;
  }

  if (missCache && missCache.expiresAt > now) {
    return null;
  }

  return undefined;
}

function cacheSuccessfulPrompt(prompt: string, now: number): void {
  successCache = {
    value: prompt,
    expiresAt: now + getSuccessCacheTtlMs(),
  };
  missCache = null;
  lastSuccessfulPrompt = prompt;
}

function cacheMiss(now: number): void {
  missCache = { expiresAt: now + MISS_CACHE_TTL_MS };
  successCache = null;
}

export async function readPromptFromGoogleDocs(): Promise<string | null> {
  const now = Date.now();
  const cached = readCachedPrompt(now);

  if (cached !== undefined) {
    if (cached) {
      console.info(
        `[prompt] google_docs cache=hit length=${cached.length} ttl=${getSuccessCacheTtlMs()}ms`,
      );
    }
    return cached;
  }

  const config = getGoogleDocsConfig();
  if (!config) {
    return null;
  }

  try {
    const auth = new google.auth.JWT({
      email: config.email,
      key: config.privateKey,
      scopes: [DOCS_READONLY_SCOPE],
    });

    const docs = google.docs({ version: 'v1', auth });
    const response = await docs.documents.get({
      documentId: config.documentId,
    });

    const prompt = extractPromptTextFromDocBody(response.data.body ?? {});

    if (!prompt) {
      cacheMiss(now);
      return null;
    }

    cacheSuccessfulPrompt(prompt, now);
    console.info(
      `[prompt] google_docs cache=miss length=${prompt.length} ttl=${getSuccessCacheTtlMs()}ms`,
    );
    return prompt;
  } catch (error) {
    console.warn(
      'Google Docs prompt fetch failed:',
      formatDocsFetchError(error),
    );

    if (lastSuccessfulPrompt) {
      return lastSuccessfulPrompt;
    }

    cacheMiss(now);
    return null;
  }
}
