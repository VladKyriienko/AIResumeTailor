export const MAX_RESUME_FILE_SIZE_BYTES = 8 * 1024 * 1024;

export const INVALID_RESUME_FILE_MESSAGE =
  'Invalid resume file. Please upload a PDF, DOCX, or TXT file up to 8 MB.';

export class ResumeFileValidationError extends Error {
  constructor(message = INVALID_RESUME_FILE_MESSAGE) {
    super(message);
    this.name = 'ResumeFileValidationError';
  }
}

const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'txt']);

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function hasPdfSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF'
  );
}

function hasZipSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

function looksLikePlainText(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;

  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  let suspicious = 0;

  for (const byte of sample) {
    if (byte === 0) {
      suspicious += 1;
      continue;
    }

    if (byte < 9 || (byte > 13 && byte < 32 && byte !== 27)) {
      suspicious += 1;
    }
  }

  return suspicious / sample.length < 0.05;
}

function matchesFileSignature(extension: string, buffer: Buffer): boolean {
  switch (extension) {
    case 'pdf':
      return hasPdfSignature(buffer);
    case 'docx':
      return hasZipSignature(buffer);
    case 'txt':
      return looksLikePlainText(buffer);
    default:
      return false;
  }
}

export async function validateResumeFile(file: File): Promise<Buffer> {
  if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    throw new ResumeFileValidationError(
      'Resume file is too large. Maximum size is 8 MB.',
    );
  }

  const extension = getFileExtension(file.name);

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new ResumeFileValidationError();
  }

  const expectedMime = MIME_BY_EXTENSION[extension];

  if (file.type && file.type !== expectedMime) {
    throw new ResumeFileValidationError();
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!matchesFileSignature(extension, buffer)) {
    throw new ResumeFileValidationError();
  }

  return buffer;
}
