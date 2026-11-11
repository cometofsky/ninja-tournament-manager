import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import Tournament from '@/models/Tournament';
import { requireAdmin, isTournamentCreator } from '@/lib/auth';

// POST /api/tournaments/[id]/archive — body { archived: boolean } (creator only)
export async function POST(req, { params }) {
  const auth = requireAdmin(req);
  if (auth.response) return auth.response;

  try {
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (typeof body?.archived !== 'boolean') {
      return NextResponse.json({ error: 'archived must be true or false' }, { status: 400 });
    }

    await connectDB();
    const t = await Tournament.findById(id);
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!isTournamentCreator(t, auth.user)) {
      return NextResponse.json({ error: 'Only the tournament creator can archive it' }, { status: 403 });
    }

    t.archived = body.archived;
    t.archivedAt = body.archived ? new Date() : null;
    await t.save();

    return NextResponse.json({ success: true, tournament: t });
  } catch (e) {
    console.error('Archive tournament error:', e);
    return NextResponse.json({ error: 'Failed to update archive state' }, { status: 500 });
  }
}
