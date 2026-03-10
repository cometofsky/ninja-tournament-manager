import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import Tournament from '@/models/Tournament';
import { requireAdmin } from '@/lib/auth';
import {
  deriveAdvancingPlayers,
  buildAndAdvance,
  getStageRoundSpan,
} from '@/lib/tournament';

export const maxDuration = 10; // Vercel Hobby plan limit

// POST /api/tournaments/[id]/advance
export async function POST(req, { params }) {
  const auth = requireAdmin(req);
  if (auth.response) return auth.response;

  try {
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await connectDB();
    const t = await Tournament.findById(id);
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (t.status === 'completed') {
      return NextResponse.json({ error: 'Tournament already completed' }, { status: 400 });
    }

    const stage = t.stages[t.currentStageIndex];
    if (!stage) return NextResponse.json({ error: 'No active stage' }, { status: 400 });

    // Check all stage matches are complete
    let allDone;
    if (stage.type === 'group') {
      const gIds = stage.groups.map(g => g.groupId);
      const gMatches = t.matches.filter(m => gIds.includes(m.groupId));
      allDone = gMatches.length > 0 && gMatches.every(m => m.status === 'completed');
    } else {
      const start = stage.round, end = stage.round + getStageRoundSpan(stage) - 1;
      const sMatches = t.matches.filter(m => m.round >= start && m.round <= end);
      allDone = sMatches.length > 0 && sMatches.every(m => m.status === 'completed');
    }
    if (!allDone) {
      return NextResponse.json({ error: 'Complete all matches before advancing to the next round.' }, { status: 400 });
    }

    const { advancing, tieBreaks } = deriveAdvancingPlayers(t, stage);
    if (tieBreaks && tieBreaks.length > 0) {
      await t.save();
      return NextResponse.json({ error: 'Resolve all tiebreaks before advancing.', tieBreaks }, { status: 400 });
    }
    if (!advancing || advancing.length === 0) {
      return NextResponse.json({ error: 'No players advancing' }, { status: 400 });
    }

    // 1 player = champion
    if (advancing.length === 1) {
      t.status = 'completed'; t.champion = advancing[0]; t.completedAt = new Date();
      stage.status = 'completed';
      await t.save();
      return NextResponse.json(t);
    }

    // ≤4 players → auto-build knockout
    if (advancing.length <= 4) {
      const updated = await buildAndAdvance(t, advancing, 'knockout', null);
      return NextResponse.json(updated);
    }

    // >4 players: admin must choose format
    stage.status = 'awaiting-next-format';
    await t.save();
    return NextResponse.json({
      ...t.toObject(),
      awaitingFormatSelection: true,
      advancing,
      message: `${advancing.length} players advancing. Choose the next stage format.`,
    });
  } catch (e) {
    console.error('Advance error:', e);
    return NextResponse.json({ error: 'Failed to advance' }, { status: 500 });
  }
}
