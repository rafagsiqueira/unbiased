import { ingest } from '../_lib/pipeline';
import { getStore } from '../_lib/store';

/**
 * Invoked by Vercel Cron (see vercel.json). Vercel sends a tokenized Authorization header.
 * Fails closed: without CRON_SECRET configured the endpoint refuses every request.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== 'Be' + 'arer ' + secret) {
    return new Response('Unauthorized', { status: 401 });
  }
  const result = await ingest({ store: await getStore() });
  return Response.json(result);
}
