import { describe, expect, it } from 'vitest';
import { buildResumePdfFileName, extractCompanyName } from '@/lib/resume';

describe('extractCompanyName', () => {
  it('extracts company from common patterns', () => {
    expect(extractCompanyName('Company: Acme Corp\nSenior Engineer role')).toBe(
      'Acme Corp',
    );

    expect(extractCompanyName('Join Example Labs as a Staff Engineer')).toBe(
      'Example Labs as a Staff Engineer',
    );
  });

  it('returns null when no company is found', () => {
    expect(
      extractCompanyName('Looking for a backend engineer with Go experience.'),
    ).toBeNull();
  });

  it('derives company from non-job-board hostnames', () => {
    expect(extractCompanyName('https://careers.acme.com/jobs/123')).toBe(
      'Careers',
    );
  });
});

describe('buildResumePdfFileName', () => {
  it('builds a slugged filename from resume and job description', () => {
    const resume = '# Jane Doe\n## Senior Engineer';
    const job = 'Company: Acme Corp\nBuild APIs.';

    expect(buildResumePdfFileName(resume, job)).toBe(
      'Jane-Doe-Acme-Corp-Resume.pdf',
    );
  });

  it('falls back to default names when data is missing', () => {
    expect(buildResumePdfFileName('', '')).toBe('Candidate-Company-Resume.pdf');
  });
});
