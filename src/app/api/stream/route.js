import { NextResponse } from 'next/server';

export const maxDuration = 10;

// Placeholder — implement SSE streaming here if needed.
export async function GET() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
