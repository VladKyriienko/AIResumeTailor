import { describe, expect, it } from 'vitest';
import {
  createInvalidZipBuffer,
  createMinimalDocxBuffer,
  INVALID_RESUME_FILE_MESSAGE,
  ResumeFileValidationError,
  validateResumeFile,
} from '@/lib/file-validation';

function createFile(name: string, type: string, bytes: Uint8Array): File {
  return new File([Buffer.from(bytes)], name, { type });
}

describe('validateResumeFile', () => {
  it('accepts a valid PDF', async () => {
    const pdfBytes = new TextEncoder().encode('%PDF-1.4 resume content');
    const file = createFile('resume.pdf', 'application/pdf', pdfBytes);

    const buffer = await validateResumeFile(file);

    expect(buffer.length).toBeGreaterThan(0);
  });

  it('accepts a valid minimal DOCX', async () => {
    const docxBytes = createMinimalDocxBuffer();
    const file = createFile(
      'resume.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      docxBytes,
    );

    await expect(validateResumeFile(file)).resolves.toBeInstanceOf(Buffer);
  });

  it('rejects ZIP archives without word/document.xml', async () => {
    const zipBytes = createInvalidZipBuffer();
    const file = createFile(
      'resume.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      zipBytes,
    );

    await expect(validateResumeFile(file)).rejects.toThrow(
      ResumeFileValidationError,
    );
  });

  it('rejects ZIP files with wrong extension and MIME', async () => {
    const zipBytes = createInvalidZipBuffer();
    const file = createFile('resume.zip', 'application/zip', zipBytes);

    await expect(validateResumeFile(file)).rejects.toThrow(
      INVALID_RESUME_FILE_MESSAGE,
    );
  });

  it('accepts plain text files', async () => {
    const txtBytes = new TextEncoder().encode(
      'John Doe\nSenior Engineer with ten years of experience.',
    );
    const file = createFile('resume.txt', 'text/plain', txtBytes);

    await expect(validateResumeFile(file)).resolves.toBeInstanceOf(Buffer);
  });

  it('rejects unsupported extensions', async () => {
    const file = createFile(
      'resume.exe',
      'application/octet-stream',
      new Uint8Array([1]),
    );

    await expect(validateResumeFile(file)).rejects.toThrow(
      ResumeFileValidationError,
    );
    await expect(validateResumeFile(file)).rejects.toThrow(
      INVALID_RESUME_FILE_MESSAGE,
    );
  });

  it('rejects mismatched MIME type', async () => {
    const pdfBytes = new TextEncoder().encode('%PDF-1.4 resume content');
    const file = createFile('resume.pdf', 'text/plain', pdfBytes);

    await expect(validateResumeFile(file)).rejects.toThrow(
      ResumeFileValidationError,
    );
  });

  it('rejects invalid magic bytes', async () => {
    const file = createFile(
      'resume.pdf',
      'application/pdf',
      new TextEncoder().encode('not a pdf'),
    );

    await expect(validateResumeFile(file)).rejects.toThrow(
      ResumeFileValidationError,
    );
  });

  it('rejects files larger than 8 MB', async () => {
    const largeBytes = new Uint8Array(8 * 1024 * 1024 + 1);
    largeBytes.set([0x25, 0x50, 0x44, 0x46], 0);
    const file = createFile('resume.pdf', 'application/pdf', largeBytes);

    await expect(validateResumeFile(file)).rejects.toThrow(
      'Resume file is too large',
    );
  });
});
