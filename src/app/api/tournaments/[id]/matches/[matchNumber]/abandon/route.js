import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import Tournament from '@/models/Tournament';
import { requireAdmin } from '@/lib/auth';
import { buildGroupStandings, getStageRoundSpan } from '@/lib/tournament';

export const maxDuration = 10;

// POST /api/tournaments/[id]/matches/[matchNumber]/abandon
export async function POST(req, { params }) {
  const auth = requireAdmin(req);
  if (auth.response) return auth.response;

  try {
    const { id, matchNumber } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await connectDB();
    const t = await Tournament.findById(id);
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (t.status === 'completed') {
      return NextResponse.json({ error: 'Tournament already completed' }, { status: 400 });
    }

    const match = t.matches.find(m => m.matchNumber === Number(matchNumber));
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (match.status === 'abandoned') {
      return NextResponse.json({ error: 'Match is already abandoned' }, { status: 400 });
    }

    // Mark as abandoned: no winner, no scores
    match.status = 'abandoned';
    match.winner = null;
    match.player1Score = null;
    match.player2Score = null;

    // Rebuild standings
    const stage = t.stages[t.currentStageIndex];
    if (stage?.type === 'group') {
      const newS = [];
      for (const g of stage.groups) {
        const gM = t.matches.filter(m => m.groupId === g.groupId && (m.status === 'completed' || m.status === 'abandoned'));
        newS.push(...buildGroupStandings(gM, g.players, g.groupId));
      }
      t.standings = newS;
    } else if (stage) {
      const stagePlayers = stage.players?.length > 0 ? stage.players : t.players;
      const start = stage.round;
      const end = start + getStageRoundSpan(stage) - 1;
      const stageM = t.matches.filter(m => m.round >= start && m.round <= end && (m.status === 'completed' || m.status === 'abandoned'));
      t.standings = buildGroupStandings(stageM, stagePlayers, null);
    }

    await t.save();
    return NextResponse.json({ success: true, tournament: t });
  } catch (e) {
    console.error('Abandon match error:', e);
    return NextResponse.json({ error: 'Failed to abandon match' }, { status: 500 });
  }
}
