import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import Tournament from '@/models/Tournament';
import { requireAdmin } from '@/lib/auth';

export const maxDuration = 10;

// POST /api/tournaments/[id]/disqualify
// Body: { player: string, action: 'disqualify' | 'reinstate' }
export async function POST(req, { params }) {
  const auth = requireAdmin(req);
  if (auth.response) return auth.response;

  try {
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const { player, action = 'disqualify' } = await req.json();
    const playerTrimmed = String(player || '').trim();
    if (!playerTrimmed) {
      return NextResponse.json({ error: 'Player name is required' }, { status: 400 });
    }
    if (!['disqualify', 'reinstate'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use "disqualify" or "reinstate"' }, { status: 400 });
    }

    await connectDB();
    const t = await Tournament.findById(id);
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (t.status === 'completed') {
      return NextResponse.json({ error: 'Tournament already completed' }, { status: 400 });
    }

    if (!t.players.includes(playerTrimmed)) {
      return NextResponse.json({ error: `Player not found: ${playerTrimmed}` }, { status: 404 });
    }

    if (!t.disqualifiedPlayers) t.disqualifiedPlayers = [];

    if (action === 'disqualify') {
      if (t.disqualifiedPlayers.includes(playerTrimmed)) {
        return NextResponse.json({ error: 'Player is already disqualified' }, { status: 400 });
      }
      t.disqualifiedPlayers.push(playerTrimmed);
    } else {
      t.disqualifiedPlayers = t.disqualifiedPlayers.filter(p => p !== playerTrimmed);
    }

    t.markModified('disqualifiedPlayers');
    await t.save();
    return NextResponse.json({ success: true, tournament: t });
  } catch (e) {
    console.error('Disqualify error:', e);
    return NextResponse.json({ error: 'Failed to update disqualification' }, { status: 500 });
  }
}
