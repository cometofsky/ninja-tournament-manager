import { connectDB } from '@/lib/db';

// Never prerender — this must hit the DB on every request.
export const dynamic = 'force-dynamic';

/**
 * Liveness/readiness probe used by the container healthcheck.
 * Returns 200 only when the MongoDB connection is reachable, so a DB outage
 * surfaces as an `unhealthy` container instead of a false-green static 200.
 */
export async function GET() {
  try {
    await connectDB();
    return Response.json({ ok: true });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }
}
