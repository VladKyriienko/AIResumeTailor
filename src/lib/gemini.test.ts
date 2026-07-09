import { describe, expect, it } from 'vitest';
import {
  GeminiApiError,
  GEMINI_MODEL_ROTATION,
  getGeminiModelRotationChain,
  getNextGeminiModelInRotation,
  parseTailorResult,
} from './gemini';

describe('getGeminiModelRotationChain', () => {
  it('starts from the primary model and cycles through the rotation list', () => {
    const models = getGeminiModelRotationChain('gemini-3.5-flash');

    expect(models).toEqual([...GEMINI_MODEL_ROTATION]);
  });

  it('wraps around when the primary model is in the middle of the list', () => {
    const models = getGeminiModelRotationChain('gemini-2.5-flash');

    expect(models).toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
      'gemini-2.5-pro',
    ]);
  });

  it('prepends unknown primary models before the rotation list', () => {
    const models = getGeminiModelRotationChain('custom-model');

    expect(models[0]).toBe('custom-model');
    expect(models.slice(1)).toEqual([...GEMINI_MODEL_ROTATION]);
  });
});

describe('getNextGeminiModelInRotation', () => {
  it('returns the next untried model in the rotation', () => {
    expect(getNextGeminiModelInRotation('gemini-3.5-flash')).toBe(
      'gemini-3.5-flash',
    );
    expect(
      getNextGeminiModelInRotation('gemini-3.5-flash', ['gemini-3.5-flash']),
    ).toBe('gemini-3.1-flash-lite');
    expect(
      getNextGeminiModelInRotation('gemini-3.5-flash', [
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite',
      ]),
    ).toBe('gemini-3-flash-preview');
  });

  it('returns null when every model in the rotation was attempted', () => {
    expect(
      getNextGeminiModelInRotation('gemini-3.5-flash', [
        ...GEMINI_MODEL_ROTATION,
      ]),
    ).toBeNull();
  });
});

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
