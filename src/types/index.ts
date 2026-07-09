export interface PageMeta {
  title?: string;
  description?: string;
}

export interface TailorRequest {
  jobDescription: string;
  resumeFile: File | null;
}

export interface TailorResult {
  tailoredResume: string;
}

export const ACCEPTED_RESUME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

export const ACCEPTED_RESUME_EXTENSIONS = '.pdf,.docx,.txt';

export const MAX_RESUME_FILE_SIZE_BYTES = 8 * 1024 * 1024;
export const MAX_RESUME_FILE_SIZE_LABEL = '8 MB';
