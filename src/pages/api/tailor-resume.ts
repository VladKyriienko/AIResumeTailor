import type { APIRoute } from 'astro';
import {
  GeminiApiError,
  GeminiConfigError,
  tailorResumeWithGemini,
} from '@/lib/gemini';
import { ResumeFileValidationError } from '@/lib/file-validation';
import {
  JobDescriptionError,
  resolveJobDescription,
} from '@/lib/job-description';
import { extractResumeText, ResumeExtractionError } from '@/lib/resume';
import { tailorRequestSchema } from '@/lib/schemas';

export const prerender = false;

const GENERIC_ERROR_MESSAGE =
  'Failed to tailor the resume. Please try again later.';

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function toUploadFile(value: FormDataEntryValue | null): File | null {
  if (!(value instanceof Blob)) return null;

  if (value instanceof File) return value;

  const blob: Blob = value;
  const extension =
    blob.type === 'application/pdf'
      ? 'pdf'
      : blob.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ? 'docx'
        : 'txt';

  return new File([blob], `resume.${extension}`, {
    type: blob.type || 'application/octet-stream',
  });
}

async function handleTailorResumeRequest(request: Request): Promise<Response> {
  const formData = await request.formData();
  const resume = toUploadFile(formData.get('resume'));
  const jobDescription = formData.get('jobDescription');

  if (!resume) {
    return jsonResponse({ error: 'Resume file is required.' }, 400);
  }

  const jobDescriptionResult = tailorRequestSchema.safeParse({
    jobDescription: typeof jobDescription === 'string' ? jobDescription : '',
  });

  if (!jobDescriptionResult.success) {
    const message =
      jobDescriptionResult.error.issues[0]?.message ??
      'Job description is required.';

    return jsonResponse({ error: message }, 400);
  }

  const resumeText = await extractResumeText(resume);
  const jobText = await resolveJobDescription(
    jobDescriptionResult.data.jobDescription,
  );
  const result = await tailorResumeWithGemini(resumeText, jobText);

  return jsonResponse({ data: result });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    return await handleTailorResumeRequest(request);
  } catch (error) {
    if (error instanceof GeminiConfigError) {
      return jsonResponse({ error: error.message }, 500);
    }

    if (error instanceof GeminiApiError) {
      return jsonResponse({ error: error.message }, error.status);
    }

    if (
      error instanceof ResumeExtractionError ||
      error instanceof ResumeFileValidationError ||
      error instanceof JobDescriptionError
    ) {
      return jsonResponse({ error: error.message }, 400);
    }

    console.error('Tailor resume failed:', error);

    return jsonResponse({ error: GENERIC_ERROR_MESSAGE }, 500);
  }
};
