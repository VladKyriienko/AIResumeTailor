const FETCH_TIMEOUT_MS = 15_000;
const MIN_JOB_DESCRIPTION_LENGTH = 100;
const MAX_JOB_DESCRIPTION_LENGTH = 50_000;

const HTML_ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

export class JobDescriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JobDescriptionError';
  }
}

export function isJobPostingUrl(input: string): boolean {
  const trimmed = input.trim();

  if (!trimmed || trimmed.includes('\n')) {
    return false;
  }

  try {
    const url = new URL(trimmed);
    return (
      url.protocol === 'http:' || url.protocol === 'https:'
    );
  } catch {
    return false;
  }
}

function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(nbsp|amp|lt|gt|quot|#39);/g,
    (match) => HTML_ENTITY_MAP[match] ?? match,
  );
}

function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');

  const withLineBreaks = withoutScripts
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  const plainText = withLineBreaks
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n/g, '\n');

  return decodeHtmlEntities(plainText)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function trimJobDescription(text: string): string {
  if (text.length <= MAX_JOB_DESCRIPTION_LENGTH)
    return text;
  return `${text.slice(0, MAX_JOB_DESCRIPTION_LENGTH).trim()}...`;
}

async function fetchJobDescriptionFromUrl(
  url: string,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    FETCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept:
          'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'User-Agent':
          'AIResumeTailor/1.0 (+https://github.com/local/ai-resume-tailor)',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new JobDescriptionError(
        `Could not load the job page (HTTP ${response.status}). Paste the description text instead.`,
      );
    }

    const contentType =
      response.headers.get('content-type') ?? '';

    if (contentType.includes('text/plain')) {
      const text = (await response.text()).trim();

      if (text.length < MIN_JOB_DESCRIPTION_LENGTH) {
        throw new JobDescriptionError(
          'The URL did not return enough job description text. Paste the description manually.',
        );
      }

      return trimJobDescription(text);
    }

    const html = await response.text();
    const text = htmlToText(html);

    if (text.length < MIN_JOB_DESCRIPTION_LENGTH) {
      throw new JobDescriptionError(
        'Could not extract enough text from the job page. Paste the description manually.',
      );
    }

    return trimJobDescription(text);
  } catch (error) {
    if (error instanceof JobDescriptionError) throw error;

    if (
      error instanceof Error &&
      error.name === 'AbortError'
    ) {
      throw new JobDescriptionError(
        'Loading the job page timed out. Paste the description text instead.',
      );
    }

    throw new JobDescriptionError(
      'Failed to load the job page. Paste the description text instead.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveJobDescription(
  input: string,
): Promise<string> {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new JobDescriptionError(
      'Job description is required.',
    );
  }

  if (isJobPostingUrl(trimmed)) {
    return fetchJobDescriptionFromUrl(trimmed);
  }

  return trimmed;
}
