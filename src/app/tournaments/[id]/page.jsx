'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Trophy, Medal, ChevronRight, AlertTriangle, CheckCircle, Pencil } from 'lucide-react';
import Navbar from '@/components/Navbar';

// ── Helpers ────────────────────────────────────────────────────────────────
function sortStandings(s) {
  return [...s].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst, gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

function stageBadgeColor(type) {
  if (type === 'group') return 'bg-blue-100 text-blue-700';
  if (type === 'round-robin') return 'bg-purple-100 text-purple-700';
  if (type === 'knockout') return 'bg-orange-100 text-orange-700';
  return 'bg-gray-100 text-gray-600';
}

// ── Score Entry Form ────────────────────────────────────────────────────────
function ScoreForm({ onSubmit, loading }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');

  function handleSubmit() {
    const a = parseInt(p1, 10), b = parseInt(p2, 10);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) { alert('Enter valid non-negative scores'); return; }
    onSubmit(a, b);
  }

  return (
    <div className="flex gap-2 mt-3 items-center">
      <input
        type="number" min={0} value={p1} onChange={e => setP1(e.target.value)}
        placeholder="0" className="w-14 border rounded-lg p-1.5 text-center text-sm font-bold focus:ring-2 focus:ring-indigo-300 focus:outline-none"
      />
      <span className="text-gray-400 font-semibold">—</span>
      <input
        type="number" min={0} value={p2} onChange={e => setP2(e.target.value)}
        placeholder="0" className="w-14 border rounded-lg p-1.5 text-center text-sm font-bold focus:ring-2 focus:ring-indigo-300 focus:outline-none"
      />
      <button onClick={handleSubmit} disabled={loading} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
        Save
      </button>
    </div>
  );
}

// ── Match Card ───────────────────────────────────────────────────────────────
function MatchCard({ match, token, onResult, onUpdate }) {
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editP1Score, setEditP1Score] = useState(match.player1Score || '');
  const [editP2Score, setEditP2Score] = useState(match.player2Score || '');
  const isCompleted = match.status === 'completed';
  const isDraw = isCompleted && !match.winner;

  async function handleScore(p1, p2) {
    setSaving(true);
    await onResult(match.matchNumber, p1, p2);
    setSaving(false);
  }

  return (
    <div className={`border rounded-xl p-4 transition-shadow ${isCompleted ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 hover:shadow-md'}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-400 font-medium">Match #{match.matchNumber}</span>
        {isCompleted && <CheckCircle className="w-4 h-4 text-green-500" />}
      </div>
      <div className="space-y-1">
        <div className={`flex justify-between items-center rounded px-2 py-1 ${isCompleted && match.winner === match.player1 ? 'bg-green-50' : ''}`}>
          <span className={`text-sm font-semibold ${isCompleted && match.winner === match.player1 ? 'text-green-700' : 'text-gray-800'}`}>
            {match.player1 || 'TBD'}
          </span>
          {isCompleted && match.player1Score != null && (
            <span className={`text-sm font-bold ${match.winner === match.player1 ? 'text-green-700' : 'text-gray-500'}`}>{match.player1Score}</span>
          )}
          {isCompleted && match.winner === match.player1 && <Medal className="w-4 h-4 text-yellow-500 ml-1" />}
        </div>
        <div className="text-center text-xs text-gray-400">vs</div>
        <div className={`flex justify-between items-center rounded px-2 py-1 ${isCompleted && match.winner === match.player2 ? 'bg-green-50' : ''}`}>
          <span className={`text-sm font-semibold ${isCompleted && match.winner === match.player2 ? 'text-green-700' : 'text-gray-800'}`}>
            {match.player2 || 'TBD'}
          </span>
          {isCompleted && match.player2Score != null && (
            <span className={`text-sm font-bold ${match.winner === match.player2 ? 'text-green-700' : 'text-gray-500'}`}>{match.player2Score}</span>
          )}
          {isCompleted && match.winner === match.player2 && <Medal className="w-4 h-4 text-yellow-500 ml-1" />}
        </div>
      </div>
      {isDraw && <p className="text-center text-xs text-gray-500 mt-1">Draw</p>}
      {token && !isCompleted && match.player1 && match.player2 && (
        <ScoreForm onSubmit={handleScore} loading={saving} />
      )}
    </div>
  );
}

// ── Standings Table ──────────────────────────────────────────────────────────
function StandingsTable({ standings, title, advancingCount }) {
  const sorted = sortStandings(standings);
  const anyPlayed = sorted.some(s => s.played > 0);
  const showAdvancing = advancingCount && anyPlayed;
  return (
    <div>
      {title && <h4 className="text-sm font-bold text-gray-700 mb-2">{title}</h4>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600">
              <th className="text-left px-2 py-1.5 rounded-tl">Player</th>
              <th className="px-2 py-1.5">P</th><th className="px-2 py-1.5">W</th>
              <th className="px-2 py-1.5">D</th><th className="px-2 py-1.5">L</th>
              <th className="px-2 py-1.5">GF</th><th className="px-2 py-1.5">GA</th>
              <th className="px-2 py-1.5">GD</th>
              <th className="px-2 py-1.5 font-bold rounded-tr">Pts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.player} className={`border-b border-gray-100 ${showAdvancing && i < advancingCount && s.points > 0 ? 'bg-green-50' : ''}`}>
                <td className="px-2 py-1.5 font-medium text-gray-800 flex items-center gap-1">
                  {showAdvancing && i < advancingCount && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
                  {s.player}
                </td>
                <td className="px-2 py-1.5 text-center text-gray-600">{s.played}</td>
                <td className="px-2 py-1.5 text-center text-gray-600">{s.wins}</td>
                <td className="px-2 py-1.5 text-center text-gray-600">{s.draws}</td>
                <td className="px-2 py-1.5 text-center text-gray-600">{s.losses}</td>
                <td className="px-2 py-1.5 text-center text-gray-600">{s.goalsFor}</td>
                <td className="px-2 py-1.5 text-center text-gray-600">{s.goalsAgainst}</td>
                <td className="px-2 py-1.5 text-center text-gray-600">{s.goalsFor - s.goalsAgainst > 0 ? '+' : ''}{s.goalsFor - s.goalsAgainst}</td>
                <td className="px-2 py-1.5 text-center font-bold text-indigo-700">{s.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdvancing && <p className="text-xs text-green-600 mt-1">🟢 Top {advancingCount} advance</p>}
    </div>
  );
}

// ── Next Format Selector ──────────────────────────────────────────────────────
function NextFormatSelector({ advancing, onSubmit }) {
  const [nextFormat, setNextFormat] = useState('');
  const [numberOfGroups, setNumberOfGroups] = useState(2);
  const [error, setError] = useState('');

  function findValidGroupCounts(n) {
    const valid = [];
    for (let i = 2; i <= n / 2; i++) {
      if (n % i === 0 && n / i >= 2) valid.push(i);
    }
    return valid;
  }

  function handleSubmit() {
    setError('');
    if (!nextFormat) { setError('Please select a format.'); return; }
    if (nextFormat === 'group') {
      const ng = Number(numberOfGroups);
      if (advancing.length % ng !== 0) {
        setError(`${advancing.length} players cannot be equally divided into ${ng} groups.`);
        return;
      }
    }
    onSubmit(nextFormat, nextFormat === 'group' ? Number(numberOfGroups) : undefined);
  }

  const validGroupCounts = findValidGroupCounts(advancing.length);

  return (
    <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-6 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600" />
        <h3 className="font-bold text-yellow-800">Choose Next Stage Format</h3>
      </div>
      <p className="text-sm text-yellow-700 mb-4">
        <strong>{advancing.length} players</strong> are advancing. Choose how the next stage will be played:
      </p>
      <div className="font-medium text-xs text-gray-600 mb-2">Advancing: {advancing.join(', ')}</div>
      <div className="space-y-2 mb-4">
        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${nextFormat === 'round-robin' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
          <input type="radio" name="nf" value="round-robin" checked={nextFormat === 'round-robin'} onChange={() => setNextFormat('round-robin')} className="mt-0.5" />
          <div>
            <div className="font-semibold text-sm">🔄 Round Robin</div>
            <div className="text-xs text-gray-500">Every player plays every other. Top {Math.floor(advancing.length / 2)} advance.</div>
          </div>
        </label>
        {validGroupCounts.length > 0 && (
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${nextFormat === 'group' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
            <input type="radio" name="nf" value="group" checked={nextFormat === 'group'} onChange={() => setNextFormat('group')} className="mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-sm">🏆 Group Stage</div>
              <div className="text-xs text-gray-500 mb-2">Split into equal groups. Top 2 from each advance.</div>
              {nextFormat === 'group' && (
                <div className="flex flex-wrap gap-2">
                  {validGroupCounts.map(n => (
                    <button key={n} type="button" onClick={() => setNumberOfGroups(n)}
                      className={`px-3 py-1 rounded text-xs font-medium border ${Number(numberOfGroups) === n ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 hover:border-indigo-400'}`}>
                      {n} groups ({advancing.length / n} each)
                    </button>
                  ))}
                </div>
              )}
            </div>
          </label>
        )}
        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${nextFormat === 'knockout' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
          <input type="radio" name="nf" value="knockout" checked={nextFormat === 'knockout'} onChange={() => setNextFormat('knockout')} className="mt-0.5" />
          <div>
            <div className="font-semibold text-sm">⚡ Knockout</div>
            <div className="text-xs text-gray-500">Direct elimination. Winners advance.</div>
          </div>
        </label>
      </div>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <button onClick={handleSubmit} className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium text-sm hover:bg-indigo-700 flex items-center gap-2">
        Confirm Format <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Tiebreak Resolver ─────────────────────────────────────────────────────────
function TiebreakResolver({ tiebreak, onResolve }) {
  const [selected, setSelected] = useState([]);

  function toggle(p) {
    setSelected(prev =>
      prev.includes(p)
        ? prev.filter(x => x !== p)
        : prev.length < tiebreak.requiredCount ? [...prev, p] : prev
    );
  }

  return (
    <div className="bg-orange-50 border border-orange-300 rounded-xl p-5 mt-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 text-orange-600" />
        <h4 className="font-bold text-orange-800">Tiebreak Required — {tiebreak.groupId}</h4>
      </div>
      <p className="text-sm text-orange-700 mb-3">
        Select <strong>{tiebreak.requiredCount}</strong> player(s) to advance from: {tiebreak.candidates.join(', ')}
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {tiebreak.candidates.map(p => (
          <button key={p} onClick={() => toggle(p)}
            className={`px-3 py-1.5 rounded-lg text-sm border font-medium transition-colors ${selected.includes(p) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white border-gray-300 hover:border-orange-400'}`}>
            {p} {selected.includes(p) ? '✓' : ''}
          </button>
        ))}
      </div>
      <button
        disabled={selected.length !== tiebreak.requiredCount}
        onClick={() => onResolve(tiebreak, selected)}
        className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-40"
      >
        Confirm ({selected.length}/{tiebreak.requiredCount} selected)
      </button>
    </div>
  );
}

// ── Main Tournament Page ──────────────────────────────────────────────────────
export default function TournamentPage({ params }) {
  const { id } = params;
  const [t, setT] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(null);
  const [advanceError, setAdvanceError] = useState('');
  const [pendingTiebreaks, setPendingTiebreaks] = useState([]);
  const [token, setToken] = useState(null);

  useEffect(() => {
    setToken(localStorage.getItem('adminToken'));
  }, []);

  const fetchT = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${id}`);
      const data = await res.json();
      setT(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    fetchT();
    const pollInterval = setInterval(fetchT, 5000);
    return () => clearInterval(pollInterval);
  }, [fetchT]);

  async function handleResult(matchNumber, p1s, p2s) {
    try {
      const res = await fetch(`/api/tournaments/${id}/matches/${matchNumber}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ player1Score: p1s, player2Score: p2s }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to save result'); return; }
      setT(data.tournament);
    } catch { alert('Network error'); }
  }

  async function handleAdvance() {
    setAdvanceError(''); setAdvancing(null); setPendingTiebreaks([]);
    try {
      const res = await fetch(`/api/tournaments/${id}/advance`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.tieBreaks?.length > 0) {
          setPendingTiebreaks(data.tieBreaks);
          setAdvanceError(data.error);
        } else {
          setAdvanceError(data.error || 'Cannot advance');
        }
        return;
      }
      if (data.awaitingFormatSelection) {
        setAdvancing(data.advancing);
        setT({ ...data, awaitingFormatSelection: undefined, advancing: undefined });
      } else {
        setT(data);
      }
    } catch { setAdvanceError('Network error'); }
  }

  async function handleSetNextFormat(nextFormat, numberOfGroups) {
    try {
      const res = await fetch(`/api/tournaments/${id}/set-next-format`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nextFormat, numberOfGroups }),
      });
      const data = await res.json();
      if (!res.ok) { setAdvanceError(data.error || 'Failed to set format'); return; }
      setAdvancing(null); setT(data);
    } catch { setAdvanceError('Network error'); }
  }

  async function handleTiebreak(tb, selected) {
    try {
      const res = await fetch(`/api/tournaments/${id}/tiebreak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stageNumber: tb.stageNumber, groupId: tb.groupId, selected }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to resolve tiebreak'); return; }
      setPendingTiebreaks(prev => prev.filter(x => x.groupId !== tb.groupId));
      fetchT();
    } catch { alert('Network error'); }
  }

  // ── Computed data ─────────────────────────────────────────────────────────
  const currentStage = useMemo(() => t?.stages?.[t.currentStageIndex], [t]);

  const stageMatchesByRound = useMemo(() => {
    if (!t || !currentStage) return [];
    let stageMsList;
    if (currentStage.type === 'group') {
      const gIds = new Set(currentStage.groups.map(g => g.groupId));
      stageMsList = t.matches.filter(m => gIds.has(m.groupId));
    } else if (currentStage.type === 'round-robin') {
      const perGroup = currentStage.playerCount || 2;
      const span = Math.max(perGroup - 1, 1);
      const start = currentStage.round, end = start + span - 1;
      stageMsList = t.matches.filter(m => m.round >= start && m.round <= end);
    } else {
      stageMsList = t.matches.filter(m => m.round === currentStage.round);
    }
    const byRound = {};
    for (const m of stageMsList) {
      byRound[m.round] = byRound[m.round] || [];
      byRound[m.round].push(m);
    }
    return Object.keys(byRound).sort((a, b) => a - b).map(r => ({ round: Number(r), matches: byRound[r] }));
  }, [t, currentStage]);

  const roundStatus = useMemo(() => stageMatchesByRound.map(rr => ({
    round: rr.round, total: rr.matches.length,
    done: rr.matches.filter(m => m.status === 'completed').length,
  })), [stageMatchesByRound]);

  const allCurrentMatchesDone = useMemo(() => {
    if (!t || !currentStage) return false;
    if (currentStage.type === 'group') {
      const gIds = new Set(currentStage.groups.map(g => g.groupId));
      const gms = t.matches.filter(m => gIds.has(m.groupId));
      return gms.length > 0 && gms.every(m => m.status === 'completed');
    }
    const perGroup = currentStage.playerCount || 2;
    const span = currentStage.type === 'round-robin' ? Math.max(perGroup - 1, 1) : 1;
    const start = currentStage.round, end = start + span - 1;
    const sms = t.matches.filter(m => m.round >= start && m.round <= end);
    return sms.length > 0 && sms.every(m => m.status === 'completed');
  }, [t, currentStage]);

  const previousStages = useMemo(() => t ? t.stages.slice(0, t.currentStageIndex) : [], [t]);

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Navbar />
      <div className="py-12 text-center text-gray-400">Loading tournament...</div>
    </div>
  );

  if (!t) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Navbar />
      <div className="py-12 text-center text-red-500">Tournament not found.</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4">
        <div className="py-8 space-y-6">
          {/* Header */}
          <div>
            <Link href="/" className="text-indigo-600 text-sm hover:underline">← All Tournaments</Link>
            <div className="flex items-start justify-between mt-2 flex-wrap gap-2">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{t.name}</h1>
                <p className="text-gray-500 mt-1 text-sm">
                  <span className="capitalize">{t.initialFormat === 'group' ? 'Group Stage' : 'Round Robin'}</span>
                  {' · '}{t.players.length} players{' · '}
                  <span className={`font-semibold ${t.status === 'completed' ? 'text-green-600' : t.status === 'in-progress' ? 'text-blue-600' : 'text-gray-500'}`}>
                    {t.status === 'completed' ? 'Completed' : t.status === 'in-progress' ? 'In Progress' : t.status}
                  </span>
                </p>
              </div>
              {t.status === 'completed' && t.champion && (
                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="font-bold text-yellow-800">Champion: {t.champion}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stage pipeline */}
          <div className="flex items-center gap-1 flex-wrap">
            {t.stages.map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${i === t.currentStageIndex ? 'bg-indigo-600 text-white' : s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {s.label}
                </span>
                {i < t.stages.length - 1 && <ChevronRight className="w-3 h-3 text-gray-400" />}
              </div>
            ))}
            {advancing && (
              <>
                <ChevronRight className="w-3 h-3 text-gray-400" />
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium animate-pulse">Choose Next Stage...</span>
              </>
            )}
          </div>

          {/* Current Stage */}
          {currentStage && t.status !== 'completed' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${stageBadgeColor(currentStage.type)}`}>
                    {currentStage.type === 'group' ? 'Group Stage' : currentStage.type === 'round-robin' ? 'Round Robin' : 'Knockout'}
                  </span>
                  <h2 className="text-xl font-bold">{currentStage.label}</h2>
                </div>
                <div className="text-sm text-gray-500">
                  {roundStatus.map(rs => (
                    <span key={rs.round} className="mr-3">
                      Round {rs.round}: <span className={rs.done === rs.total ? 'text-green-600 font-semibold' : 'text-orange-500 font-semibold'}>{rs.done}/{rs.total}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Group Stage */}
              {currentStage.type === 'group' && (
                <div className="space-y-8">
                  {currentStage.groups.map(group => {
                    const groupMatches = t.matches.filter(m => m.groupId === group.groupId);
                    const groupStandings = (t.standings || []).filter(s => s.groupId === group.groupId);
                    const groupByRound = {};
                    for (const m of groupMatches) {
                      groupByRound[m.round] = groupByRound[m.round] || [];
                      groupByRound[m.round].push(m);
                    }
                    return (
                      <div key={group.groupId}>
                        <h3 className="text-lg font-bold text-indigo-700 mb-3 border-b pb-2">{group.name}</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div>
                            <p className="text-sm font-semibold text-gray-600 mb-2">Matches</p>
                            <div className="space-y-4">
                              {Object.keys(groupByRound).sort((a, b) => a - b).map(r => (
                                <div key={r}>
                                  <p className="text-xs text-gray-400 font-semibold mb-1 uppercase">Matchday {Number(r) - group.round + 1}</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {groupByRound[r].map(m => (
                                      <MatchCard key={m.matchNumber} match={m} token={token} onResult={handleResult} />
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-600 mb-2">Standings</p>
                            <StandingsTable standings={groupStandings} advancingCount={2} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Round Robin or Knockout */}
              {(currentStage.type === 'round-robin' || currentStage.type === 'knockout') && (
                <div className="space-y-6">
                  {stageMatchesByRound.map(rr => (
                    <div key={rr.round}>
                      {currentStage.type === 'round-robin' && (
                        <p className="text-sm text-gray-500 font-semibold mb-2 uppercase">
                          Matchday {rr.round - currentStage.round + 1}
                          {roundStatus.find(rs => rs.round === rr.round)?.done === roundStatus.find(rs => rs.round === rr.round)?.total
                            ? <span className="text-green-600 ml-2">✓ Complete</span> : null}
                        </p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {rr.matches.map(m => <MatchCard key={m.matchNumber} match={m} token={token} onResult={handleResult} />)}
                      </div>
                    </div>
                  ))}
                  {currentStage.type === 'round-robin' && t.standings?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-gray-600 mb-2">Standings</p>
                      <StandingsTable standings={t.standings.filter(s => !s.groupId)} advancingCount={currentStage.advancingCount} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pending Tiebreaks */}
          {pendingTiebreaks.length > 0 && token && (
            <div>
              {pendingTiebreaks.map((tb, i) => (
                <TiebreakResolver key={i} tiebreak={tb} onResolve={handleTiebreak} />
              ))}
            </div>
          )}

          {/* Awaiting format selection */}
          {advancing && token && (
            <NextFormatSelector advancing={advancing} onSubmit={handleSetNextFormat} />
          )}

          {/* Advance button */}
          {token && t.status !== 'completed' && !advancing && (
            <div className="flex flex-col items-start gap-2">
              <button
                onClick={handleAdvance}
                disabled={!allCurrentMatchesDone}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all
                  ${allCurrentMatchesDone ? 'bg-green-600 hover:bg-green-700 shadow-md hover:shadow-lg' : 'bg-gray-300 cursor-not-allowed text-gray-500'}`}
              >
                <ChevronRight className="w-5 h-5" />
                {allCurrentMatchesDone ? 'Advance to Next Round' : 'Complete all matches to advance'}
              </button>
              {!allCurrentMatchesDone && (
                <p className="text-xs text-gray-500">All matches in the current stage must be completed before advancing.</p>
              )}
              {advanceError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm max-w-lg">
                  {advanceError}
                </div>
              )}
            </div>
          )}

          {/* Previous stages */}
          {previousStages.length > 0 && (
            <details className="bg-gray-50 rounded-xl border border-gray-200">
              <summary className="px-5 py-3 font-semibold cursor-pointer text-gray-600 text-sm">
                View Previous Stages ({previousStages.length})
              </summary>
              <div className="px-5 pb-5 space-y-6">
                {previousStages.map(stage => {
                  const stageMs = stage.type === 'group'
                    ? t.matches.filter(m => stage.groups.some(g => g.groupId === m.groupId))
                    : t.matches.filter(m => m.round === stage.round);
                  return (
                    <div key={stage.stageNumber}>
                      <h3 className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">
                        {stage.label} <span className="text-green-600 text-xs ml-1">✓ Completed</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {stageMs.map(m => (
                          <div key={m.matchNumber} className="text-xs bg-white border rounded-lg p-2">
                            <div className={`flex justify-between ${m.winner === m.player1 ? 'font-bold text-green-700' : 'text-gray-600'}`}>
                              <span>{m.player1}</span><span>{m.player1Score}</span>
                            </div>
                            <div className="text-center text-gray-300 text-xs">—</div>
                            <div className={`flex justify-between ${m.winner === m.player2 ? 'font-bold text-green-700' : 'text-gray-600'}`}>
                              <span>{m.player2}</span><span>{m.player2Score}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          {/* Completed state */}
          {t.status === 'completed' && (
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 rounded-xl p-8 text-center">
              <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-3" />
              <h2 className="text-3xl font-bold text-yellow-800 mb-1">Tournament Complete!</h2>
              {t.champion && <p className="text-xl text-yellow-700">🏆 Champion: <span className="font-extrabold">{t.champion}</span></p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
