import { z } from 'zod';

export const tailorResultSchema = z.object({
  tailoredResume: z.string().trim().min(1),
});

export const tailorApiSuccessSchema = z.object({
  data: tailorResultSchema,
});

export const tailorApiErrorSchema = z.object({
  error: z.string().min(1),
});

export const tailorRequestSchema = z.object({
  jobDescription: z.string().trim().min(1, 'Job description is required.'),
});

export type TailorResultSchema = z.infer<typeof tailorResultSchema>;
