import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Tournament from '@/models/Tournament';
import { requireAdmin } from '@/lib/auth';
import { deriveAdvancingPlayers, buildAndAdvance } from '@/lib/tournament';

export const maxDuration = 10; // Vercel Hobby plan limit

// POST /api/tournaments/[id]/set-next-format
export async function POST(req, { params }) {
  const auth = requireAdmin(req);
  if (auth.response) return auth.response;

  try {
    const { id } = params;
    const { nextFormat, numberOfGroups } = await req.json();

    if (!['round-robin', 'group', 'knockout'].includes(nextFormat)) {
      return NextResponse.json({ error: 'Invalid nextFormat' }, { status: 400 });
    }

    await connectDB();
    const t = await Tournament.findById(id);
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const stage = t.stages[t.currentStageIndex];
    if (!stage || stage.status !== 'awaiting-next-format') {
      return NextResponse.json({ error: 'Not awaiting format selection' }, { status: 400 });
    }

    const { advancing, tieBreaks } = deriveAdvancingPlayers(t, stage);
    if (tieBreaks?.length > 0) {
      return NextResponse.json({ error: 'Unresolved tiebreaks', tieBreaks }, { status: 400 });
    }

    if (nextFormat === 'group') {
      const ng = Number(numberOfGroups);
      if (!ng || ng < 2) return NextResponse.json({ error: 'At least 2 groups required' }, { status: 400 });
      if (advancing.length % ng !== 0) {
        return NextResponse.json({ error: `${advancing.length} players cannot be equally divided into ${ng} groups` }, { status: 400 });
      }
    }

    const updated = await buildAndAdvance(t, advancing, nextFormat, numberOfGroups);
    return NextResponse.json(updated);
  } catch (e) {
    console.error('Set next format error:', e.message);
    return NextResponse.json({ error: e.message || 'Failed to set format' }, { status: 500 });
  }
}
