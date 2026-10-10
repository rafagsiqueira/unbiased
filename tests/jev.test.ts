import { describe, expect, it, vi } from 'vitest';
import { CRITERIA, buildRequest, parseResponse, scoreArticle, toBiasScore } from '../api/_lib/jev';

describe('jev', () => {
  it('maps level positions onto -100…+100', () => {
    expect(toBiasScore(0, 1).value).toBe(-100);
    expect(toBiasScore(2, 1).value).toBe(0);
    expect(toBiasScore(4, 1).value).toBe(100);
    expect(toBiasScore(3.5, 0.4).value).toBe(75);
    expect(toBiasScore(9, 2)).toEqual({ value: 100, confidence: 1 });
  });
  it('builds a score request without the outlet name', () => {
    const req = buildRequest({ title: 'T', summary: 'S' });
    expect(req.state).toBe('T\n\nS');
    expect(req.questions.political_lean).toMatchObject({ type: 'score', criteria: CRITERIA });
  });
  it('parses the documented response shape', () => {
    expect(parseResponse({ answers: { political_lean: { type: 'score', score: 1, confidence: 0.5 } } })).toEqual({ value: -50, confidence: 0.5 });
    expect(() => parseResponse({ answers: {} })).toThrow();
  });
  it('posts with bearer auth', async () => {
    const f = vi.fn().mockResolvedValue(Response.json({ answers: { political_lean: { type: 'score', score: 2, confidence: 1 } } }));
    const r = await scoreArticle({ title: 'a', summary: '' }, { apiKey: 'k' }, f as unknown as typeof fetch);
    expect(r.value).toBe(0);
    expect(f.mock.calls[0][1].headers.authorization).toBe('Be' + 'arer k');
  });
});
