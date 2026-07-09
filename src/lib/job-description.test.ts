import { describe, expect, it } from 'vitest';
import { isJobPostingUrl } from '@/lib/job-url';
import { extractTextFromHtml } from '@/lib/job-description';

describe('isJobPostingUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isJobPostingUrl('https://example.com/jobs/123')).toBe(true);
    expect(isJobPostingUrl('http://careers.example.com/role')).toBe(true);
  });

  it('rejects plain text and multiline input', () => {
    expect(isJobPostingUrl('Senior Engineer at Example')).toBe(false);
    expect(isJobPostingUrl('https://example.com\nextra line')).toBe(false);
  });

  it('rejects non-http protocols', () => {
    expect(isJobPostingUrl('ftp://example.com/job')).toBe(false);
    expect(isJobPostingUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('extractTextFromHtml', () => {
  it('extracts title, headings, paragraphs, and list items', () => {
    const html = `
      <html>
        <head><title>Senior Engineer</title></head>
        <body>
          <nav>Skip me</nav>
          <h1>Senior Engineer</h1>
          <p>Build scalable systems.</p>
          <ul><li>TypeScript</li><li>Vue</li></ul>
          <footer>Copyright</footer>
        </body>
      </html>
    `;

    const text = extractTextFromHtml(html);

    expect(text).toContain('Senior Engineer');
    expect(text).toContain('Build scalable systems.');
    expect(text).toContain('TypeScript');
    expect(text).toContain('Vue');
    expect(text).not.toContain('Skip me');
    expect(text).not.toContain('Copyright');
  });

  it('removes scripts and styles', () => {
    const html = `
      <html>
        <head>
          <style>body { color: red; }</style>
          <script>alert('xss')</script>
        </head>
        <body><p>Visible content only.</p></body>
      </html>
    `;

    const text = extractTextFromHtml(html);

    expect(text).toContain('Visible content only.');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('color: red');
  });
});
