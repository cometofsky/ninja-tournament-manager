import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import Tournament from '@/models/Tournament';
import { requireAdmin } from '@/lib/auth';

export const maxDuration = 10; // Vercel Hobby plan limit

// GET /api/tournaments/[id]
export async function GET(req, { params }) {
  try {
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    await connectDB();
    const t = await Tournament.findById(id);
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(t);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// PATCH /api/tournaments/[id] — admin updates (currently supports player rename)
export async function PATCH(req, { params }) {
  const auth = requireAdmin(req);
  if (auth.response) return auth.response;

  try {
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const { oldName, newName } = await req.json();
    const oldTrimmed = String(oldName || '').trim();
    const newTrimmed = String(newName || '').trim();

    if (!oldTrimmed || !newTrimmed) {
      return NextResponse.json({ error: 'oldName and newName are required' }, { status: 400 });
    }

    if (oldTrimmed === newTrimmed) {
      return NextResponse.json({ error: 'New name must be different from current name' }, { status: 400 });
    }

    await connectDB();
    const t = await Tournament.findById(id);
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const exists = t.players.includes(oldTrimmed);
    if (!exists) {
      return NextResponse.json({ error: `Player not found: ${oldTrimmed}` }, { status: 404 });
    }

    const duplicate = t.players.some(
      p => p !== oldTrimmed && p.toLowerCase() === newTrimmed.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json({ error: `Player already exists: ${newTrimmed}` }, { status: 409 });
    }

    const rename = (value) => (value === oldTrimmed ? newTrimmed : value);

    t.players = t.players.map(rename);

    t.stages.forEach(stage => {
      stage.players = (stage.players || []).map(rename);
      (stage.groups || []).forEach(group => {
        group.players = (group.players || []).map(rename);
      });
    });

    t.matches.forEach(match => {
      match.player1 = rename(match.player1);
      match.player2 = rename(match.player2);
      match.winner = rename(match.winner);
    });

    t.standings.forEach(standing => {
      standing.player = rename(standing.player);
    });

    t.tieBreaks.forEach(tb => {
      tb.candidates = (tb.candidates || []).map(rename);
      tb.selected = (tb.selected || []).map(rename);
    });

    if (t.champion) {
      t.champion = rename(t.champion);
    }

    t.renameHistory.push({
      oldName: oldTrimmed,
      newName: newTrimmed,
      renamedAt: new Date(),
      renamedBy: auth.user?.email || null,
    });

    await t.save();
    return NextResponse.json({ success: true, tournament: t });
  } catch (e) {
    console.error('Rename player error:', e);
    return NextResponse.json({ error: 'Failed to rename player' }, { status: 500 });
  }
}
