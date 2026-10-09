import type { ScoreRequest, ScoreResponse } from '../shared/types';
import { scoreMany } from './_lib/scoring';

const MAX_BATCH = 20;

export async function POST(request: Request): Promise<Response> {
  let body: ScoreRequest;
  try {
    body = (await request.json()) as ScoreRequest;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const items = (body.articles ?? [])
    .filter((a) => a && typeof a.id === 'string' && typeof a.title === 'string')
    .slice(0, MAX_BATCH)
    .map((a) => ({ id: a.id, title: a.title.slice(0, 500), summary: String(a.summary ?? '').slice(0, 800) }));

  const scores = await scoreMany(items);
  return Response.json({ scores } satisfies ScoreResponse);
}
