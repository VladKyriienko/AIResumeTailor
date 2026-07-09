import { describe, expect, it } from 'vitest';
import { GeminiApiError, parseTailorResult } from './gemini';

describe('parseTailorResult', () => {
  it('parses valid JSON responses', () => {
    const result = parseTailorResult(
      JSON.stringify({ tailoredResume: '# Jane Doe\nTailored content' }),
    );

    expect(result.tailoredResume).toContain('Jane Doe');
  });

  it('parses fenced JSON responses', () => {
    const result = parseTailorResult(
      '```json\n{"tailoredResume":"# Tailored resume"}\n```',
    );

    expect(result.tailoredResume).toBe('# Tailored resume');
  });

  it('uses lenient extraction for malformed JSON', () => {
    const result = parseTailorResult(
      '{"tailoredResume":"Line one\\nLine two"}',
    );

    expect(result.tailoredResume).toContain('Line one');
  });

  it('throws a 502 GeminiApiError for invalid payloads', () => {
    expect(() => parseTailorResult('{"wrongField":"value"}')).toThrow(
      GeminiApiError,
    );

    try {
      parseTailorResult('not json at all');
    } catch (error) {
      expect(error).toBeInstanceOf(GeminiApiError);
      expect((error as GeminiApiError).status).toBe(502);
    }
  });
});
