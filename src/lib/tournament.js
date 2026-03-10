/**
 * Tournament logic helpers — pure functions, no DB access.
 * Shared between API route handlers.
 */

// Round-robin via Berger circle rotation
export function generateRoundRobinMatches(players, round, stageType, groupId, startMn) {
  if (players.length < 2) return [];
  const list = [...players];
  if (list.length % 2 !== 0) list.push('BYE');
  const n = list.length;
  const totalRounds = n - 1;
  const matches = [];
  let mn = startMn;
  for (let r = 0; r < totalRounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const p1 = list[i];
      const p2 = list[n - 1 - i];
      if (p1 !== 'BYE' && p2 !== 'BYE') {
        matches.push({
          round: round + r, matchNumber: mn++,
          player1: p1, player2: p2,
          status: 'pending', stageType,
          groupId: groupId || null,
        });
      }
    }
    list.splice(1, 0, list.pop());
  }
  return matches;
}

// Single-elimination bracket for one round
export function generateKnockoutMatches(players, round, stageType, startMn) {
  const matches = [];
  let mn = startMn;
  for (let i = 0; i < players.length; i += 2) {
    const p2 = players[i + 1] || null;
    matches.push({
      round, matchNumber: mn++,
      player1: players[i], player2: p2,
      status: p2 ? 'pending' : 'completed',
      winner: p2 ? null : players[i],
      stageType, groupId: null,
    });
  }
  return matches;
}

export function nextMatchNumber(t) {
  if (!t.matches.length) return 1;
  return Math.max(...t.matches.map(m => m.matchNumber)) + 1;
}

export function buildGroupStandings(completedMatches, players, groupId) {
  const map = {};
  players.forEach(p => {
    map[p] = { player: p, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0, groupId: groupId || null };
  });
  completedMatches.forEach(m => {
    const s1 = map[m.player1]; const s2 = map[m.player2];
    if (!s1 || !s2 || m.player1Score == null || m.player2Score == null) return;
    s1.played++; s2.played++;
    s1.goalsFor += m.player1Score; s1.goalsAgainst += m.player2Score;
    s2.goalsFor += m.player2Score; s2.goalsAgainst += m.player1Score;
    if (m.player1Score > m.player2Score) { s1.wins++; s1.points += 3; s2.losses++; }
    else if (m.player2Score > m.player1Score) { s2.wins++; s2.points += 3; s1.losses++; }
    else { s1.draws++; s1.points++; s2.draws++; s2.points++; }
  });
  return Object.values(map);
}

export function sortStandings(standings) {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst, gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

export function knockoutLabel(n) {
  if (n === 2) return 'Final';
  if (n === 3 || n === 4) return 'Semi-Final';
  if (n >= 5 && n <= 8) return 'Quarter-Final';
  if (n >= 9 && n <= 16) return 'Round of 16';
  if (n >= 17 && n <= 32) return 'Round of 32';
  if (n >= 33 && n <= 64) return 'Round of 64';
  return `Knockout Round of ${n}`;
}

export function knockoutMatchType(n) {
  if (n === 2) return 'final';
  if (n === 3 || n === 4) return 'semifinal';
  return 'knockout';
}

export function getStageRoundSpan(stage) {
  if (stage.type === 'group') {
    const perGroup = stage.groups.length > 0 ? stage.groups[0].players.length : 2;
    return Math.max(perGroup - 1, 1);
  }
  if (stage.type === 'round-robin') {
    const n = stage.playerCount || 2;
    return Math.max(n - 1, 1);
  }
  return 1;
}

export function deriveAdvancingPlayers(t, stage) {
  if (stage.type === 'group') {
    const unresolved = t.tieBreaks.filter(tb => tb.stageNumber === stage.stageNumber && !tb.resolved);
    if (unresolved.length > 0) return { advancing: [], tieBreaks: unresolved };

    const advancing = [];
    for (const group of stage.groups) {
      const gMatches = t.matches.filter(m => m.groupId === group.groupId && m.status === 'completed');
      const standings = sortStandings(buildGroupStandings(gMatches, group.players, group.groupId));
      const advCount = 2;
      if (standings.length < advCount) { advancing.push(...standings.map(s => s.player)); continue; }

      const cutoffPoints = standings[advCount - 1].points;
      const nextPoints = standings[advCount]?.points;

      if (nextPoints !== undefined && cutoffPoints === nextPoints) {
        const definite = standings.slice(0, advCount - 1).map(s => s.player);
        const tiedCandidates = standings.filter(s => s.points === cutoffPoints).map(s => s.player);
        const needed = advCount - definite.length;
        const resolved = t.tieBreaks.find(tb => tb.stageNumber === stage.stageNumber && tb.groupId === group.groupId && tb.resolved);
        if (resolved) {
          advancing.push(...definite, ...resolved.selected.slice(0, needed));
        } else {
          t.tieBreaks.push({ stageNumber: stage.stageNumber, groupId: group.groupId, candidates: tiedCandidates, requiredCount: needed, resolved: false, selected: [] });
          return { advancing: [], tieBreaks: t.tieBreaks.filter(tb => !tb.resolved) };
        }
      } else {
        advancing.push(...standings.slice(0, advCount).map(s => s.player));
      }
    }
    return { advancing, tieBreaks: [] };
  }

  if (stage.type === 'round-robin') {
    const stageStart = stage.round, stageEnd = stage.round + getStageRoundSpan(stage) - 1;
    const rrMatches = t.matches.filter(m => m.round >= stageStart && m.round <= stageEnd && m.status === 'completed');
    const stagePlayers = stage.players?.length > 0 ? stage.players
      : stage.groups.length > 0 ? stage.groups.flatMap(g => g.players)
      : t.players;
    const standings = sortStandings(buildGroupStandings(rrMatches, stagePlayers, null));
    const count = Math.floor(standings.length / 2);
    return { advancing: standings.slice(0, count).map(s => s.player), tieBreaks: [] };
  }

  // Knockout
  const stageMatches = t.matches.filter(m => m.round === stage.round);
  const advancing = stageMatches.map(m => m.winner).filter(Boolean);
  return { advancing, tieBreaks: [] };
}

export async function buildAndAdvance(t, advancing, nextFormat, numberOfGroups) {
  const currentStage = t.stages[t.currentStageIndex];
  const nextRound = currentStage.round + getStageRoundSpan(currentStage);
  const nextStageNum = currentStage.stageNumber + 1;
  let mn = nextMatchNumber(t);
  let newStage, newMatches = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  if (nextFormat === 'group') {
    const ng = Number(numberOfGroups);
    if (!ng || ng < 2) throw new Error('At least 2 groups required');
    if (advancing.length % ng !== 0) throw new Error(`${advancing.length} players cannot be equally divided into ${ng} groups`);
    const perGroup = advancing.length / ng;
    const groups = [];
    for (let g = 0; g < ng; g++) {
      const gPlayers = advancing.slice(g * perGroup, (g + 1) * perGroup);
      const groupId = `s${nextStageNum}-g${g}`;
      groups.push({ groupId, name: `Group ${letters[g]}`, players: gPlayers, round: nextRound });
      const gm = generateRoundRobinMatches(gPlayers, nextRound, 'group', groupId, mn);
      mn += gm.length; newMatches.push(...gm);
    }
    newStage = { stageNumber: nextStageNum, label: 'Group Stage', type: 'group', round: nextRound, players: advancing, groups, playerCount: advancing.length, advancingCount: ng * 2, status: 'active' };
  } else if (nextFormat === 'round-robin') {
    const rrM = generateRoundRobinMatches(advancing, nextRound, 'knockout', null, mn);
    newMatches.push(...rrM);
    newStage = { stageNumber: nextStageNum, label: 'Round Robin', type: 'round-robin', round: nextRound, players: advancing, groups: [], playerCount: advancing.length, advancingCount: Math.floor(advancing.length / 2), status: 'active' };
  } else {
    const label = knockoutLabel(advancing.length);
    const stageType = knockoutMatchType(advancing.length);
    const km = generateKnockoutMatches(advancing, nextRound, stageType, mn);
    newMatches.push(...km);
    newStage = { stageNumber: nextStageNum, label, type: 'knockout', round: nextRound, players: advancing, groups: [], playerCount: advancing.length, advancingCount: Math.floor(advancing.length / 2), status: 'active' };
  }

  t.stages[t.currentStageIndex].status = 'completed';
  t.stages.push(newStage);
  t.matches.push(...newMatches);
  t.currentStageIndex = t.stages.length - 1;

  if (newStage.type === 'group') {
    t.standings = newStage.groups.flatMap(g => buildGroupStandings([], g.players, g.groupId));
  } else {
    t.standings = buildGroupStandings([], advancing, null);
  }

  await t.save();
  return t;
}
