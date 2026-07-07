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
