import * as cheerio from 'cheerio';
import { isJobPostingUrl } from '@/lib/job-url';
import {
  assertSafeFetchUrl,
  SSRF_BLOCKED_MESSAGE,
  UrlValidationError,
} from '@/lib/url-validation';

const FETCH_TIMEOUT_MS = 15_000;
const MIN_JOB_DESCRIPTION_LENGTH = 100;
const MAX_JOB_DESCRIPTION_LENGTH = 50_000;
const MAX_REDIRECTS = 5;

const REMOVABLE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'nav',
  'footer',
  'header',
  'aside',
  'iframe',
  '[role="banner"]',
  '[role="navigation"]',
  '[role="contentinfo"]',
  '[aria-label*="cookie" i]',
  '[class*="cookie" i]',
  '[id*="cookie" i]',
  '[class*="consent" i]',
  '[class*="advert" i]',
  '[class*="ad-" i]',
  '[id*="advert" i]',
].join(', ');

export class JobDescriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JobDescriptionError';
  }
}

export { isJobPostingUrl } from '@/lib/job-url';

function trimJobDescription(text: string): string {
  if (text.length <= MAX_JOB_DESCRIPTION_LENGTH) return text;
  return `${text.slice(0, MAX_JOB_DESCRIPTION_LENGTH).trim()}...`;
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);
  $(REMOVABLE_SELECTORS).remove();

  const parts: string[] = [];

  const title = $('title').first().text().trim();
  if (title) parts.push(title);

  $('h1, h2, h3, h4, h5, h6, p, li').each((_, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    if (text) parts.push(text);
  });

  if (parts.length === 0) {
    const bodyText = $('body').text();
    if (bodyText.trim()) parts.push(bodyText);
  }

  return normalizeExtractedText(parts.join('\n'));
}

async function safeFetchJobPage(initialUrl: string): Promise<Response> {
  let currentUrl = initialUrl;

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    await assertSafeFetchUrl(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
          'User-Agent':
            'AIResumeTailor/1.0 (+https://github.com/local/ai-resume-tailor)',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new JobDescriptionError(
            'Could not load the job page. Paste the description text instead.',
          );
        }

        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new JobDescriptionError(
    'Could not load the job page. Paste the description text instead.',
  );
}

async function fetchJobDescriptionFromUrl(url: string): Promise<string> {
  try {
    const response = await safeFetchJobPage(url);

    if (!response.ok) {
      throw new JobDescriptionError(
        `Could not load the job page (HTTP ${response.status}). Paste the description text instead.`,
      );
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('text/plain')) {
      const text = normalizeExtractedText(await response.text());

      if (text.length < MIN_JOB_DESCRIPTION_LENGTH) {
        throw new JobDescriptionError(
          'The URL did not return enough job description text. Paste the description manually.',
        );
      }

      return trimJobDescription(text);
    }

    const html = await response.text();
    const text = extractTextFromHtml(html);

    if (text.length < MIN_JOB_DESCRIPTION_LENGTH) {
      throw new JobDescriptionError(
        'Could not extract enough text from the job page. Paste the description manually.',
      );
    }

    return trimJobDescription(text);
  } catch (error) {
    if (error instanceof JobDescriptionError) throw error;

    if (error instanceof UrlValidationError) {
      throw new JobDescriptionError(SSRF_BLOCKED_MESSAGE);
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new JobDescriptionError(
        'Loading the job page timed out. Paste the description text instead.',
      );
    }

    throw new JobDescriptionError(
      'Failed to load the job page. Paste the description text instead.',
    );
  }
}

export async function resolveJobDescription(input: string): Promise<string> {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new JobDescriptionError('Job description is required.');
  }

  if (isJobPostingUrl(trimmed)) {
    return fetchJobDescriptionFromUrl(trimmed);
  }

  return trimmed;
}
