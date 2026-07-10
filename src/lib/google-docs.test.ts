import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const docsGetMock = vi.fn();

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: vi.fn().mockImplementation((config: unknown) => config),
    },
    docs: vi.fn(() => ({
      documents: {
        get: docsGetMock,
      },
    })),
  },
}));

import { google } from 'googleapis';
import {
  extractPromptTextFromDocBody,
  formatServiceAccountPrivateKey,
  readPromptFromGoogleDocs,
  resetGoogleDocsPromptCacheForTests,
} from './google-docs';

const ENV_KEYS = [
  'GOOGLE_DOCS_DOCUMENT_ID',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
] as const;

function buildDocBody(text: string) {
  return {
    content: [
      {
        paragraph: {
          elements: [{ textRun: { content: text } }],
        },
      },
    ],
  };
}

describe('formatServiceAccountPrivateKey', () => {
  it('replaces escaped newlines', () => {
    expect(formatServiceAccountPrivateKey('-----BEGIN\\nKEY\\n-----END')).toBe(
      '-----BEGIN\nKEY\n-----END',
    );
  });
});

describe('extractPromptTextFromDocBody', () => {
  it('returns empty string for an empty document body', () => {
    expect(extractPromptTextFromDocBody({ content: [] })).toBe('');
  });
});

describe('readPromptFromGoogleDocs', () => {
  const previousEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

  beforeEach(() => {
    vi.useRealTimers();
    resetGoogleDocsPromptCacheForTests();
    docsGetMock.mockReset();
    vi.mocked(google.auth.JWT).mockClear();
    vi.mocked(google.docs).mockClear();

    for (const key of ENV_KEYS) {
      previousEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    vi.useRealTimers();

    for (const key of ENV_KEYS) {
      if (previousEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousEnv[key];
      }
    }
  });

  function setFullConfig(): void {
    process.env.GOOGLE_DOCS_DOCUMENT_ID = 'doc-id';
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL =
      'sa@project.iam.gserviceaccount.com';
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = 'key-with\\nnewline';
  }

  it('returns null when env is not fully configured', async () => {
    expect(await readPromptFromGoogleDocs()).toBeNull();
    expect(docsGetMock).not.toHaveBeenCalled();
  });

  it('returns null for an empty Google Doc', async () => {
    setFullConfig();
    docsGetMock.mockResolvedValue({ data: { body: { content: [] } } });

    expect(await readPromptFromGoogleDocs()).toBeNull();
    expect(docsGetMock).toHaveBeenCalledTimes(1);
  });

  it('returns prompt from a valid Google Doc', async () => {
    setFullConfig();
    const prompt = 'Tailor resume {{JOB_DESCRIPTION}} {{RESUME_TEXT}}';
    docsGetMock.mockResolvedValue({
      data: { body: buildDocBody(prompt) },
    });

    expect(await readPromptFromGoogleDocs()).toBe(prompt);
    expect(docsGetMock).toHaveBeenCalledWith({ documentId: 'doc-id' });
    expect(google.auth.JWT).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'sa@project.iam.gserviceaccount.com',
        key: 'key-with\nnewline',
        scopes: ['https://www.googleapis.com/auth/documents.readonly'],
      }),
    );
  });

  it('returns cached prompt without a second API call', async () => {
    setFullConfig();
    const prompt = 'Cached {{JOB_DESCRIPTION}} {{RESUME_TEXT}}';
    docsGetMock.mockResolvedValue({
      data: { body: buildDocBody(prompt) },
    });

    await readPromptFromGoogleDocs();
    await readPromptFromGoogleDocs();

    expect(docsGetMock).toHaveBeenCalledTimes(1);
  });

  it('returns stale cached prompt when Google API fails after cache expiry', async () => {
    vi.useFakeTimers();
    setFullConfig();
    const prompt = 'Stale {{JOB_DESCRIPTION}} {{RESUME_TEXT}}';
    docsGetMock.mockResolvedValueOnce({
      data: { body: buildDocBody(prompt) },
    });

    await readPromptFromGoogleDocs();

    vi.advanceTimersByTime(30 * 1000 + 1);
    docsGetMock.mockRejectedValueOnce(new Error('API unavailable'));

    await expect(readPromptFromGoogleDocs()).resolves.toBe(prompt);
    expect(docsGetMock).toHaveBeenCalledTimes(2);
  });
});
