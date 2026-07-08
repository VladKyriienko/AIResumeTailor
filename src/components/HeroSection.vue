<script setup lang="ts">
import { computed, ref } from 'vue';
import { isJobPostingUrl } from '@/lib/job-description';
import { downloadResumePdf } from '@/lib/resume';
import {
  ACCEPTED_RESUME_EXTENSIONS,
  ACCEPTED_RESUME_TYPES,
  type TailorRequest,
  type TailorResult,
} from '@/types';

const jobDescription =
  ref<TailorRequest['jobDescription']>('');
const resumeFile = ref<TailorRequest['resumeFile']>(null);
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const tailorResult = ref<TailorResult | null>(null);

const canSubmit = computed(
  () =>
    Boolean(jobDescription.value.trim()) &&
    resumeFile.value !== null &&
    !isSubmitting.value,
);

const isVacancyUrl = computed(() =>
  isJobPostingUrl(jobDescription.value),
);

function isAcceptedResumeFile(file: File): boolean {
  const extension = file.name
    .split('.')
    .pop()
    ?.toLowerCase();
  const acceptedExtensions = ['pdf', 'docx', 'txt'];

  if (extension && acceptedExtensions.includes(extension)) {
    return true;
  }

  return ACCEPTED_RESUME_TYPES.includes(
    file.type as (typeof ACCEPTED_RESUME_TYPES)[number],
  );
}

function handleFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;

  errorMessage.value = null;
  tailorResult.value = null;

  if (!file) {
    resumeFile.value = null;
    return;
  }

  if (!isAcceptedResumeFile(file)) {
    input.value = '';
    resumeFile.value = null;
    errorMessage.value =
      'Unsupported file type. Please upload PDF, DOCX, or TXT.';
    return;
  }

  resumeFile.value = file;
}

async function submitTailorRequest(
  resume: File,
  description: string,
): Promise<TailorResult> {
  const formData = new FormData();
  formData.append('resume', resume);
  formData.append('jobDescription', description);

  const response = await fetch('/api/tailor-resume', {
    method: 'POST',
    body: formData,
  });

  const rawBody = await response.text();
  let payload: { data?: TailorResult; error?: string };

  if (!rawBody.trim()) {
    if (
      response.status === 504 ||
      response.status === 502
    ) {
      throw new Error(
        'Server timed out. Gemini can take 20+ seconds — check your Vercel plan limits and try again.',
      );
    }

    throw new Error(
      `Server returned an empty response (${response.status}).`,
    );
  }

  try {
    payload = JSON.parse(rawBody) as {
      data?: TailorResult;
      error?: string;
    };
  } catch {
    throw new Error(
      'Server returned an invalid response. Try again later.',
    );
  }

  if (!response.ok) {
    throw new Error(
      payload.error ?? 'Request failed. Please try again.',
    );
  }

  if (!payload.data) {
    throw new Error('Unexpected response from the server.');
  }

  return payload.data;
}

async function handleSubmit(): Promise<void> {
  if (!canSubmit.value || !resumeFile.value) return;

  isSubmitting.value = true;
  errorMessage.value = null;
  tailorResult.value = null;

  try {
    tailorResult.value = await submitTailorRequest(
      resumeFile.value,
      jobDescription.value.trim(),
    );
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Something went wrong. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
}

function handleReset(): void {
  jobDescription.value = '';
  resumeFile.value = null;
  errorMessage.value = null;
  tailorResult.value = null;
}

async function handleDownloadPdf(): Promise<void> {
  if (!tailorResult.value) return;

  const date = new Date().toISOString().slice(0, 10);
  await downloadResumePdf(
    tailorResult.value.tailoredResume,
    `tailored-resume-${date}.pdf`,
  );
}
</script>

<template>
  <section class="hero">
    <p class="eyebrow">AI-powered resume tailoring</p>
    <h1>Match your resume to any job in minutes</h1>
    <p class="subtitle">
      Upload your resume, paste a job description or vacancy
      URL, and get an upgraded version tailored with Gemini.
    </p>

    <form class="form" @submit.prevent="handleSubmit">
      <label class="label" for="resume-file">Resume</label>
      <input
        id="resume-file"
        class="file-input"
        type="file"
        :accept="ACCEPTED_RESUME_EXTENSIONS"
        :disabled="isSubmitting"
        @change="handleFileChange"
      />
      <p v-if="resumeFile" class="file-name">
        Selected: {{ resumeFile.name }}
      </p>

      <label class="label" for="job-description"
        >Job description or vacancy URL</label
      >
      <textarea
        id="job-description"
        v-model="jobDescription"
        rows="8"
        placeholder="Paste the job description or a link to the vacancy (e.g. LinkedIn, Djinni, company careers page)..."
        :disabled="isSubmitting"
      />
      <p v-if="isVacancyUrl" class="hint">
        Vacancy URL detected — we will fetch and extract the
        job description on submit.
      </p>

      <p v-if="errorMessage" class="error" role="alert">
        {{ errorMessage }}
      </p>

      <div class="actions">
        <button type="submit" :disabled="!canSubmit">
          <span
            v-if="isSubmitting"
            class="button-spinner"
            aria-hidden="true"
          />
          {{
            isSubmitting
              ? 'Tailoring with Gemini...'
              : 'Tailor my resume'
          }}
        </button>
        <button
          v-if="tailorResult"
          type="button"
          class="secondary"
          @click="handleReset"
        >
          Start over
        </button>
      </div>
    </form>

    <section v-if="tailorResult" class="results">
      <div class="results-header">
        <h2>Tailored resume</h2>
        <button
          type="button"
          class="secondary"
          @click="handleDownloadPdf"
        >
          Download PDF
        </button>
      </div>
      <pre class="resume-output">{{
        tailorResult.tailoredResume
      }}</pre>
    </section>
  </section>
</template>

<style scoped>
.hero {
  width: min(900px, 100%);
  margin: 0 auto;
  padding: 4rem 1.5rem 6rem;
  text-align: center;
}

.eyebrow {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #7aa2ff;
}

h1 {
  margin: 0 0 1rem;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 1.1;
}

.subtitle {
  margin: 0 auto 2rem;
  max-width: 36rem;
  color: #a8b3cc;
  line-height: 1.6;
}

.form {
  display: grid;
  gap: 0.75rem;
  text-align: left;
}

.label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #c5d0e6;
}

textarea {
  width: 100%;
  padding: 1rem;
  border: 1px solid #2a3550;
  border-radius: 0.75rem;
  background: #121a2e;
  color: inherit;
  font: inherit;
  resize: vertical;
}

textarea:focus {
  outline: 2px solid #4f7cff;
  outline-offset: 2px;
}

.file-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px dashed #2a3550;
  border-radius: 0.75rem;
  background: #121a2e;
  color: #c5d0e6;
  font: inherit;
  cursor: pointer;
}

.file-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.file-input::file-selector-button {
  margin-right: 0.75rem;
  padding: 0.5rem 0.875rem;
  border: 0;
  border-radius: 0.5rem;
  background: #2a3550;
  color: #e8edf7;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.file-name {
  margin: 0;
  font-size: 0.875rem;
  color: #a8b3cc;
}

.hint {
  margin: 0;
  font-size: 0.875rem;
  color: #7aa2ff;
}

.error {
  margin: 0;
  padding: 0.75rem 1rem;
  border: 1px solid #7a3040;
  border-radius: 0.75rem;
  background: #2a1520;
  color: #ffb4c0;
  font-size: 0.875rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: 0;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, #4f7cff, #6b4dff);
  color: white;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.button-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgb(255 255 255 / 35%);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

button.secondary {
  background: #2a3550;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.results {
  margin-top: 2.5rem;
  padding-top: 2rem;
  border-top: 1px solid #2a3550;
  text-align: left;
}

.results-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.results-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.resume-output {
  margin: 0;
  padding: 1rem;
  border: 1px solid #2a3550;
  border-radius: 0.75rem;
  background: #121a2e;
  color: #e8edf7;
  font: inherit;
  white-space: pre-wrap;
  overflow-x: auto;
}
</style>
