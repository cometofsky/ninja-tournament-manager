import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Tournament from '@/models/Tournament';
import { requireAdmin } from '@/lib/auth';

export const maxDuration = 10; // Vercel Hobby plan limit

// POST /api/tournaments/[id]/tiebreak
export async function POST(req, { params }) {
  const auth = requireAdmin(req);
  if (auth.response) return auth.response;

  try {
    const { id } = params;
    const { stageNumber, groupId, selected } = await req.json();

    if (!stageNumber || !groupId || !Array.isArray(selected)) {
      return NextResponse.json({ error: 'stageNumber, groupId and selected required' }, { status: 400 });
    }

    await connectDB();
    const t = await Tournament.findById(id);
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const tb = t.tieBreaks.find(x => x.stageNumber === stageNumber && x.groupId === groupId && !x.resolved);
    if (!tb) return NextResponse.json({ error: 'No pending tiebreak' }, { status: 404 });
    if (selected.length !== tb.requiredCount) {
      return NextResponse.json({ error: `Select exactly ${tb.requiredCount} player(s)` }, { status: 400 });
    }
    if (!selected.every(p => tb.candidates.includes(p))) {
      return NextResponse.json({ error: 'Invalid player in selection' }, { status: 400 });
    }

    tb.resolved = true;
    tb.selected = selected;
    await t.save();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to resolve tiebreak' }, { status: 500 });
  }
}
