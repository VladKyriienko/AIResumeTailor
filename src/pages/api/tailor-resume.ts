import type { APIRoute } from 'astro';
import {
  GeminiApiError,
  GeminiConfigError,
  tailorResumeWithGemini,
} from '@/lib/gemini';
import {
  JobDescriptionError,
  resolveJobDescription,
} from '@/lib/job-description';
import {
  extractResumeText,
  ResumeExtractionError,
} from '@/lib/resume';

export const prerender = false;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const resume = formData.get('resume');
    const jobDescription = formData.get('jobDescription');

    if (!(resume instanceof File)) {
      return jsonResponse(
        { error: 'Resume file is required.' },
        400,
      );
    }

    if (
      typeof jobDescription !== 'string' ||
      !jobDescription.trim()
    ) {
      return jsonResponse(
        { error: 'Job description is required.' },
        400,
      );
    }

    const resumeText = await extractResumeText(resume);
    const jobText = await resolveJobDescription(
      jobDescription.trim(),
    );
    const result = await tailorResumeWithGemini(
      resumeText,
      jobText,
    );

    return jsonResponse({ data: result });
  } catch (error) {
    if (error instanceof GeminiConfigError) {
      return jsonResponse({ error: error.message }, 500);
    }

    if (error instanceof GeminiApiError) {
      return jsonResponse(
        { error: error.message },
        error.status,
      );
    }

    if (
      error instanceof ResumeExtractionError ||
      error instanceof JobDescriptionError
    ) {
      return jsonResponse({ error: error.message }, 400);
    }

    console.error('Tailor resume failed:', error);

    return jsonResponse(
      {
        error:
          'Failed to tailor the resume. Check your Gemini API key and try again.',
      },
      500,
    );
  }
};
