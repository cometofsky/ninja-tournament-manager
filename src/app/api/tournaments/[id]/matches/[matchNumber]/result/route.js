import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import Tournament from '@/models/Tournament';
import { requireAdmin } from '@/lib/auth';
import { buildGroupStandings, getStageRoundSpan } from '@/lib/tournament';

export const maxDuration = 10; // Vercel Hobby plan limit

// POST /api/tournaments/[id]/matches/[matchNumber]/result
export async function POST(req, { params }) {
  const auth = requireAdmin(req);
  if (auth.response) return auth.response;

  try {
    const { id, matchNumber } = params;
    const { player1Score, player2Score } = await req.json();

    if (player1Score == null || player2Score == null) {
      return NextResponse.json({ error: 'Both scores required' }, { status: 400 });
    }
    const p1s = Number(player1Score), p2s = Number(player2Score);
    if (!Number.isFinite(p1s) || !Number.isFinite(p2s)) {
      return NextResponse.json({ error: 'Scores must be numbers' }, { status: 400 });
    }
    if (p1s < 0 || p2s < 0) {
      return NextResponse.json({ error: 'Scores cannot be negative' }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await connectDB();
    const t = await Tournament.findById(id);
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (t.status === 'completed') {
      return NextResponse.json({ error: 'Tournament completed' }, { status: 400 });
    }

    const match = t.matches.find(m => m.matchNumber === Number(matchNumber));
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    match.player1Score = p1s;
    match.player2Score = p2s;
    if (p1s > p2s) match.winner = match.player1;
    else if (p2s > p1s) match.winner = match.player2;
    else {
      // Draw allowed in group/round-robin; in knockout player1 wins as tiebreaker
      match.winner = (match.stageType === 'group') ? null : match.player1;
    }
    match.status = 'completed';

    // Rebuild standings
    const stage = t.stages[t.currentStageIndex];
    if (stage?.type === 'group') {
      const newS = [];
      for (const g of stage.groups) {
        const gM = t.matches.filter(m => m.groupId === g.groupId && m.status === 'completed');
        newS.push(...buildGroupStandings(gM, g.players, g.groupId));
      }
      t.standings = newS;
    } else if (stage) {
      const stagePlayers = stage.players?.length > 0 ? stage.players : t.players;
      const start = stage.round;
      const end = start + getStageRoundSpan(stage) - 1;
      const stageM = t.matches.filter(m => m.round >= start && m.round <= end && m.status === 'completed');
      t.standings = buildGroupStandings(stageM, stagePlayers, null);
    }

    // Auto-complete if this was the final match
    if (match.stageType === 'final' && match.winner) {
      t.status = 'completed';
      t.champion = match.winner;
      t.completedAt = new Date();
      if (stage) stage.status = 'completed';
    }

    await t.save();
    return NextResponse.json({ success: true, tournament: t });
  } catch (e) {
    console.error('Match result error:', e);
    return NextResponse.json({ error: 'Failed to update match' }, { status: 500 });
  }
}
