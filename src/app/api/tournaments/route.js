import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Tournament from '@/models/Tournament';
import { requireAdmin } from '@/lib/auth';
import {
  generateRoundRobinMatches,
  buildGroupStandings,
} from '@/lib/tournament';

export const maxDuration = 10; // Vercel Hobby plan limit

// GET /api/tournaments — list all tournaments
export async function GET() {
  try {
    await connectDB();
    const list = await Tournament.find()
      .sort({ createdAt: -1 })
      .select('name players status initialFormat createdAt champion stages currentStageIndex');
    return NextResponse.json(list);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// POST /api/tournaments — create a tournament (admin only)
export async function POST(req) {
  const auth = requireAdmin(req);
  if (auth.response) return auth.response;

  try {
    const { name, players, format, numberOfGroups, randomOrder } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Tournament name required' }, { status: 400 });
    }
    if (!['round-robin', 'group'].includes(format)) {
      return NextResponse.json({ error: 'Format must be round-robin or group' }, { status: 400 });
    }
    if (!Array.isArray(players) || players.length < 2) {
      return NextResponse.json({ error: 'At least 2 players required' }, { status: 400 });
    }

    let ordered = players.map(p => String(p).trim()).filter(Boolean);
    const seen = new Set();
    for (const p of ordered) {
      if (seen.has(p)) {
        return NextResponse.json({ error: `Duplicate player: "${p}"` }, { status: 400 });
      }
      seen.add(p);
    }
    if (randomOrder) ordered = ordered.sort(() => Math.random() - 0.5);

    let stages = [], matches = [], standings = [];

    if (format === 'group') {
      const ng = Number(numberOfGroups);
      if (!ng || ng < 2) return NextResponse.json({ error: 'At least 2 groups required' }, { status: 400 });
      if (ordered.length % ng !== 0) {
        return NextResponse.json({ error: `${ordered.length} players cannot be equally divided into ${ng} groups` }, { status: 400 });
      }
      const perGroup = ordered.length / ng;
      if (perGroup < 2) return NextResponse.json({ error: 'Each group needs at least 2 players' }, { status: 400 });

      const groups = [];
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let mn = 1;
      for (let g = 0; g < ng; g++) {
        const gP = ordered.slice(g * perGroup, (g + 1) * perGroup);
        const groupId = `s1-g${g}`;
        groups.push({ groupId, name: `Group ${letters[g]}`, players: gP, round: 1 });
        const gm = generateRoundRobinMatches(gP, 1, 'group', groupId, mn);
        mn += gm.length; matches.push(...gm);
        standings.push(...buildGroupStandings([], gP, groupId));
      }
      stages.push({
        stageNumber: 1, label: 'Group Stage', type: 'group', round: 1,
        players: ordered, groups, playerCount: ordered.length,
        advancingCount: ng * 2, status: 'active',
      });
    } else {
      const rrM = generateRoundRobinMatches(ordered, 1, 'knockout', null, 1);
      matches.push(...rrM);
      stages.push({
        stageNumber: 1, label: 'Round Robin', type: 'round-robin', round: 1,
        players: ordered, groups: [], playerCount: ordered.length,
        advancingCount: Math.floor(ordered.length / 2), status: 'active',
      });
      standings = buildGroupStandings([], ordered, null);
    }

    await connectDB();
    const t = await Tournament.create({
      name: name.trim(), players: ordered,
      initialFormat: format,
      numberOfGroups: format === 'group' ? Number(numberOfGroups) : null,
      status: 'in-progress', currentStageIndex: 0,
      stages, matches, standings, tieBreaks: [],
      createdBy: auth.user.sub,
    });

    return NextResponse.json(t, { status: 201 });
  } catch (e) {
    console.error('Create tournament error:', e);
    return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 });
  }
}
