import type { APIContext } from 'astro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/pages/api/tailor-resume';

const tailorResumeWithGemini = vi.fn();

vi.mock('@/lib/gemini', () => ({
  GeminiApiError: class GeminiApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = 'GeminiApiError';
      this.status = status;
    }
  },
  GeminiConfigError: class GeminiConfigError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'GeminiConfigError';
    }
  },
  tailorResumeWithGemini: (...args: unknown[]) =>
    tailorResumeWithGemini(...args),
}));

function createResumeFile(): File {
  const bytes = new TextEncoder().encode(
    'John Doe\nSenior Engineer with extensive experience in TypeScript and Vue.',
  );

  return new File([bytes], 'resume.txt', {
    type: 'text/plain',
  });
}

function createRequest(formData: FormData): Request {
  return new Request('http://localhost/api/tailor-resume', {
    method: 'POST',
    body: formData,
  });
}

function createApiContext(request: Request): APIContext {
  return {
    request,
    params: {},
    locals: {},
    redirect: vi.fn(),
    url: new URL('http://localhost/api/tailor-resume'),
    clientAddress: '127.0.0.1',
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      has: vi.fn(),
      headers: vi.fn(),
    },
    site: undefined,
    generator: 'test',
    props: {},
  } as unknown as APIContext;
}

describe('POST /api/tailor-resume', () => {
  beforeEach(() => {
    tailorResumeWithGemini.mockReset();
    tailorResumeWithGemini.mockResolvedValue({
      tailoredResume: '# Jane Doe\nTailored resume content',
    });
  });

  it('returns tailored resume data with mocked Gemini', async () => {
    const formData = new FormData();
    formData.append('resume', createResumeFile());
    formData.append(
      'jobDescription',
      'Company: Acme Corp\nWe are hiring a senior engineer with TypeScript experience and modern frontend skills.',
    );

    const response = await POST(createApiContext(createRequest(formData)));

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      data?: { tailoredResume: string };
    };

    expect(payload.data?.tailoredResume).toContain('Jane Doe');
    expect(tailorResumeWithGemini).toHaveBeenCalledOnce();
  });

  it('returns 400 when resume file is missing', async () => {
    const formData = new FormData();
    formData.append('jobDescription', 'A valid job description.');

    const response = await POST(createApiContext(createRequest(formData)));

    expect(response.status).toBe(400);

    const payload = (await response.json()) as { error?: string };
    expect(payload.error).toBe('Resume file is required.');
  });

  it('returns a generic 500 message for unexpected errors', async () => {
    tailorResumeWithGemini.mockRejectedValue(new Error('database exploded'));

    const formData = new FormData();
    formData.append('resume', createResumeFile());
    formData.append(
      'jobDescription',
      'Company: Acme Corp\nWe are hiring a senior engineer with TypeScript experience and modern frontend skills.',
    );

    const response = await POST(createApiContext(createRequest(formData)));

    expect(response.status).toBe(500);

    const payload = (await response.json()) as { error?: string };
    expect(payload.error).toBe(
      'Failed to tailor the resume. Please try again later.',
    );
    expect(payload.error).not.toContain('database');
  });
});
