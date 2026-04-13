'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trophy, Medal, ChevronRight, AlertTriangle, CheckCircle, Pencil, Ban, UserX } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { clearAdminToken, getStoredAdminToken } from '@/lib/clientAuth';

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
  if (type === 'group') return 'bg-[#edf4df] text-[#35531f] border border-[#c8d7a4]';
  if (type === 'round-robin') return 'bg-[#f4ede7] text-[#7D6D61] border border-[#e3d4c6]';
  if (type === 'knockout') return 'bg-[#e9f1dd] text-[#4F772D] border border-[#bfd09d]';
  return 'bg-gray-100 text-gray-600 border border-gray-200';
}

const fieldClassName = 'w-full h-11 rounded-xl border border-[#c7d1b2] bg-white px-3 text-base text-[#1f311a] shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#90A955]/35 focus:border-[#90A955]';
const smallScoreInputClassName = 'w-14 h-10 rounded-lg border border-[#c7d1b2] bg-white text-center text-sm font-bold text-[#1f311a] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#90A955]/35 focus:border-[#90A955]';
const primaryButtonClassName = 'bg-[#4F772D] text-white px-3 py-1.5 rounded-lg text-sm hover:bg-[#3e5e23] disabled:opacity-50';

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
        placeholder="0" className={smallScoreInputClassName}
      />
      <span className="text-gray-400 font-semibold">—</span>
      <input
        type="number" min={0} value={p2} onChange={e => setP2(e.target.value)}
        placeholder="0" className={smallScoreInputClassName}
      />
      <button onClick={handleSubmit} disabled={loading} className={primaryButtonClassName}>
        Save
      </button>
    </div>
  );
}

// ── Match Card ───────────────────────────────────────────────────────────────
function MatchCard({ match, token, onResult, onUpdate, onAbandon, disqualifiedPlayers }) {
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editP1Score, setEditP1Score] = useState(match.player1Score ?? '');
  const [editP2Score, setEditP2Score] = useState(match.player2Score ?? '');
  const [abandoning, setAbandoning] = useState(false);
  const isCompleted = match.status === 'completed';
  const isAbandoned = match.status === 'abandoned';
  const isDraw = isCompleted && !match.winner;
  const dq = new Set(disqualifiedPlayers || []);

  useEffect(() => {
    setEditP1Score(match.player1Score ?? '');
    setEditP2Score(match.player2Score ?? '');
    setEditing(false);
  }, [match.player1Score, match.player2Score, match.status]);

  async function handleScore(p1, p2) {
    setSaving(true);
    await onResult(match.matchNumber, p1, p2);
    setSaving(false);
  }

  async function handleEditSave() {
    const p1 = Number(editP1Score);
    const p2 = Number(editP2Score);
    if (!Number.isFinite(p1) || !Number.isFinite(p2) || p1 < 0 || p2 < 0) {
      alert('Enter valid non-negative scores');
      return;
    }

    setSaving(true);
    const ok = await onUpdate(match.matchNumber, p1, p2);
    setSaving(false);
    if (ok) setEditing(false);
  }

  async function handleAbandonClick() {
    if (!confirm(`Abandon Match #${match.matchNumber}? Both players will receive -2 points.`)) return;
    setAbandoning(true);
    await onAbandon(match.matchNumber);
    setAbandoning(false);
  }

  return (
    <div className={`border rounded-xl p-4 transition-shadow ${
      isAbandoned ? 'bg-red-50 border-red-200' :
      isCompleted ? 'bg-[#fafbf7] border-[#dbe4c9]' : 'bg-white border-[#d9e0cd] hover:shadow-md'
    }`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-[#7D6D61] font-medium">Match #{match.matchNumber}</span>
        {isCompleted && <CheckCircle className="w-4 h-4 text-[#4F772D]" />}
        {isAbandoned && (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
            <Ban className="w-3 h-3" /> Abandoned
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className={`grid grid-cols-[minmax(0,1fr)_3rem_1.25rem] items-center gap-2 rounded px-2 py-1 ${
          isCompleted && match.winner === match.player1 ? 'bg-green-50' :
          isAbandoned ? 'bg-red-50' : ''
        }`}>
          <span className={`min-w-0 text-base font-semibold ${
            isCompleted && match.winner === match.player1 ? 'text-[#35531f]' :
            isAbandoned ? 'text-red-700' :
            dq.has(match.player1) ? 'text-gray-400 line-through' : 'text-gray-800'
          }`}>
            {match.player1 || 'TBD'}
            {dq.has(match.player1) && <span className="ml-1 text-xs text-red-500 no-underline">[DQ]</span>}
          </span>
          <span className={`text-center text-base font-bold ${match.winner === match.player1 ? 'text-[#35531f]' : 'text-gray-500'}`}>
            {isCompleted && match.player1Score != null ? match.player1Score : ''}
          </span>
          <span className="flex justify-end">
            {isCompleted && match.winner === match.player1 && <Medal className="w-4 h-4 text-yellow-500" />}
          </span>
        </div>
        <div className="text-center text-sm text-[#a4968b]">vs</div>
        <div className={`grid grid-cols-[minmax(0,1fr)_3rem_1.25rem] items-center gap-2 rounded px-2 py-1 ${
          isCompleted && match.winner === match.player2 ? 'bg-green-50' :
          isAbandoned ? 'bg-red-50' : ''
        }`}>
          <span className={`min-w-0 text-base font-semibold ${
            isCompleted && match.winner === match.player2 ? 'text-[#35531f]' :
            isAbandoned ? 'text-red-700' :
            dq.has(match.player2) ? 'text-gray-400 line-through' : 'text-gray-800'
          }`}>
            {match.player2 || 'TBD'}
            {dq.has(match.player2) && <span className="ml-1 text-xs text-red-500 no-underline">[DQ]</span>}
          </span>
          <span className={`text-center text-base font-bold ${match.winner === match.player2 ? 'text-[#35531f]' : 'text-gray-500'}`}>
            {isCompleted && match.player2Score != null ? match.player2Score : ''}
          </span>
          <span className="flex justify-end">
            {isCompleted && match.winner === match.player2 && <Medal className="w-4 h-4 text-yellow-500" />}
          </span>
        </div>
      </div>
      {isDraw && <p className="text-center text-sm text-[#7D6D61] mt-1">Draw</p>}
      {isAbandoned && <p className="text-center text-sm text-red-500 mt-1 font-medium">−2 pts each</p>}
      {token && !isCompleted && !isAbandoned && match.player1 && match.player2 && (
        <div className="space-y-2 mt-3">
          <ScoreForm onSubmit={handleScore} loading={saving} />
          <button
            onClick={handleAbandonClick}
            disabled={abandoning}
            className="text-sm px-2.5 py-1.5 rounded-lg bg-white border border-red-300 hover:border-red-500 text-red-600 flex items-center gap-1 disabled:opacity-50"
          >
            <Ban className="w-3.5 h-3.5" /> {abandoning ? 'Abandoning...' : 'Abandon Match'}
          </button>
        </div>
      )}
      {token && isCompleted && match.player1 && match.player2 && (
        <div className="mt-3">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-sm px-2.5 py-1.5 rounded-lg bg-white border border-[#c7d1b2] hover:border-[#90A955] text-[#314b24] flex items-center gap-1"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit Result
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min={0}
                  value={editP1Score}
                  onChange={e => setEditP1Score(e.target.value)}
                  className={smallScoreInputClassName}
                />
                <span className="text-gray-400 font-semibold">—</span>
                <input
                  type="number"
                  min={0}
                  value={editP2Score}
                  onChange={e => setEditP2Score(e.target.value)}
                  className={smallScoreInputClassName}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEditSave}
                  disabled={saving}
                  className={primaryButtonClassName}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setEditP1Score(match.player1Score ?? '');
                    setEditP2Score(match.player2Score ?? '');
                    setEditing(false);
                  }}
                  disabled={saving}
                  className="bg-[#ece8e0] text-[#5f554d] px-3 py-1.5 rounded-lg text-sm hover:bg-[#e2dbd1] disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
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
      {title && <h4 className="text-base font-bold text-[#314b24] mb-2">{title}</h4>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse overflow-hidden rounded-xl">
          <thead>
            <tr className="bg-[#eef3e4] text-[#5f554d]">
              <th className="text-left px-2 py-2 rounded-tl">Player</th>
              <th className="px-2 py-2">P</th><th className="px-2 py-2">W</th>
              <th className="px-2 py-2">D</th><th className="px-2 py-2">L</th>
              <th className="px-2 py-2">GF</th><th className="px-2 py-2">GA</th>
              <th className="px-2 py-2">GD</th>
              <th className="px-2 py-2 font-bold rounded-tr">Pts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.player} className={`border-b border-[#e8ecdf] ${showAdvancing && i < advancingCount && s.points > 0 ? 'bg-[#f2f7e8]' : 'bg-white/80'}`}>
                <td className="px-2 py-2 font-medium text-gray-800 flex items-center gap-1">
                  {showAdvancing && i < advancingCount && s.points > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
                  {s.player}
                </td>
                <td className="px-2 py-2 text-center text-gray-600">{s.played}</td>
                <td className="px-2 py-2 text-center text-gray-600">{s.wins}</td>
                <td className="px-2 py-2 text-center text-gray-600">{s.draws}</td>
                <td className="px-2 py-2 text-center text-gray-600">{s.losses}</td>
                <td className="px-2 py-2 text-center text-gray-600">{s.goalsFor}</td>
                <td className="px-2 py-2 text-center text-gray-600">{s.goalsAgainst}</td>
                <td className="px-2 py-2 text-center text-gray-600">{s.goalsFor - s.goalsAgainst > 0 ? '+' : ''}{s.goalsFor - s.goalsAgainst}</td>
                <td className="px-2 py-2 text-center font-bold text-[#4F772D]">{s.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdvancing && <p className="text-sm text-[#4F772D] mt-1">Top {advancingCount} advance</p>}
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
    for (let i = 2; i <= Math.floor(n / 2); i++) {
      if (Math.floor(n / i) >= 2) valid.push(i);
    }
    return valid;
  }

  function handleSubmit() {
    setError('');
    if (!nextFormat) { setError('Please select a format.'); return; }
    if (nextFormat === 'group') {
      const ng = Number(numberOfGroups);
      if (advancing.length < ng * 2) {
        setError(`Need at least 2 players per group (${ng} groups requires at least ${ng * 2} players).`);
        return;
      }
    }
    onSubmit(nextFormat, nextFormat === 'group' ? Number(numberOfGroups) : undefined);
  }

  const validGroupCounts = findValidGroupCounts(advancing.length);

  return (
    <div className="bg-[#fbf8ef] border border-[#d8cfb4] rounded-xl p-6 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-[#7D6D61]" />
        <h3 className="font-bold text-[#5f554d]">Choose Next Stage Format</h3>
      </div>
      <p className="text-sm text-[#7D6D61] mb-4">
        <strong>{advancing.length} players</strong> are advancing. Choose how the next stage will be played:
      </p>
      <div className="font-medium text-xs text-gray-600 mb-2">Advancing: {advancing.join(', ')}</div>
      <div className="space-y-2 mb-4">
        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${nextFormat === 'round-robin' ? 'border-[#90A955] bg-[#f2f7e8]' : 'border-[#ddd5cb] bg-white'}`}>
          <input type="radio" name="nf" value="round-robin" checked={nextFormat === 'round-robin'} onChange={() => setNextFormat('round-robin')} className="mt-0.5" />
          <div>
            <div className="font-semibold text-sm">🔄 Round Robin</div>
            <div className="text-xs text-gray-500">Every player plays every other. Top {Math.floor(advancing.length / 2)} advance.</div>
          </div>
        </label>
        {validGroupCounts.length > 0 && (
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${nextFormat === 'group' ? 'border-[#90A955] bg-[#f2f7e8]' : 'border-[#ddd5cb] bg-white'}`}>
            <input type="radio" name="nf" value="group" checked={nextFormat === 'group'} onChange={() => setNextFormat('group')} className="mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-sm">🏆 Group Stage</div>
              <div className="text-xs text-gray-500 mb-2">Split into equal groups. Top 2 from each advance.</div>
              {nextFormat === 'group' && (
                <div className="flex flex-wrap gap-2">
                  {validGroupCounts.map(n => (
                    <button key={n} type="button" onClick={() => setNumberOfGroups(n)}
                      className={`px-3 py-1 rounded text-xs font-medium border ${Number(numberOfGroups) === n ? 'bg-[#4F772D] text-white border-[#4F772D]' : 'border-[#c7d1b2] text-[#314b24] hover:border-[#90A955]'}`}>
                      {n} groups (~{Math.ceil(advancing.length / n)} each)
                    </button>
                  ))}
                </div>
              )}
            </div>
          </label>
        )}
        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${nextFormat === 'knockout' ? 'border-[#90A955] bg-[#f2f7e8]' : 'border-[#ddd5cb] bg-white'}`}>
          <input type="radio" name="nf" value="knockout" checked={nextFormat === 'knockout'} onChange={() => setNextFormat('knockout')} className="mt-0.5" />
          <div>
            <div className="font-semibold text-sm">⚡ Knockout</div>
            <div className="text-xs text-gray-500">Direct elimination. Winners advance.</div>
          </div>
        </label>
      </div>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <button onClick={handleSubmit} className="bg-[#4F772D] text-white px-5 py-2 rounded-lg font-medium text-sm hover:bg-[#3e5e23] flex items-center gap-2">
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
    <div className="bg-[#fbf7ef] border border-[#e0d3bf] rounded-xl p-5 mt-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 text-[#7D6D61]" />
        <h4 className="font-bold text-[#5f554d]">Tiebreak Required — {tiebreak.groupId}</h4>
      </div>
      <p className="text-sm text-[#7D6D61] mb-3">
        Select <strong>{tiebreak.requiredCount}</strong> player(s) to advance from: {tiebreak.candidates.join(', ')}
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {tiebreak.candidates.map(p => (
          <button key={p} onClick={() => toggle(p)}
            className={`px-3 py-1.5 rounded-lg text-sm border font-medium transition-colors ${selected.includes(p) ? 'bg-[#7D6D61] text-white border-[#7D6D61]' : 'bg-white border-[#d7c8bb] text-[#5f554d] hover:border-[#7D6D61]'}`}>
            {p} {selected.includes(p) ? '✓' : ''}
          </button>
        ))}
      </div>
      <button
        disabled={selected.length !== tiebreak.requiredCount}
        onClick={() => onResolve(tiebreak, selected)}
        className="bg-[#7D6D61] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#695c52] disabled:opacity-40"
      >
        Confirm ({selected.length}/{tiebreak.requiredCount} selected)
      </button>
    </div>
  );
}

// ── Main Tournament Page ──────────────────────────────────────────────────────
export default function TournamentPage({ params }) {
  const { id } = params;
  const router = useRouter();
  const [t, setT] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(null);
  const [advanceError, setAdvanceError] = useState('');
  const [pendingTiebreaks, setPendingTiebreaks] = useState([]);
  const [token, setToken] = useState(null);
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [disqualifyPlayer, setDisqualifyPlayer] = useState('');
  const [disqualifyLoading, setDisqualifyLoading] = useState(false);
  const [disqualifyError, setDisqualifyError] = useState('');
  const [playerFilter, setPlayerFilter] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const lastInitializedStageRef = useRef(null);

  useEffect(() => {
    const refreshAuth = () => setToken(getStoredAdminToken());
    refreshAuth();
    window.addEventListener('storage', refreshAuth);
    window.addEventListener('auth-change', refreshAuth);
    return () => {
      window.removeEventListener('storage', refreshAuth);
      window.removeEventListener('auth-change', refreshAuth);
    };
  }, []);

  const handleAuthFailure = useCallback(() => {
    clearAdminToken();
    setToken(null);
    setAdvanceError('Session expired. Please login again.');
    alert('Session expired. Please login again.');
    router.push('/login');
  }, [router]);

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
    if (!token) {
      handleAuthFailure();
      return;
    }

    try {
      const res = await fetch(`/api/tournaments/${id}/matches/${matchNumber}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ player1Score: p1s, player2Score: p2s }),
      });
      const data = await res.json();
      if (res.status === 401) {
        handleAuthFailure();
        return false;
      }
      if (!res.ok) { alert(data.error || 'Failed to save result'); return false; }
      setT(data.tournament);
      return true;
    } catch {
      alert('Network error');
      return false;
    }
  }

  async function handleUpdateResult(matchNumber, p1s, p2s) {
    return handleResult(matchNumber, p1s, p2s);
  }

  async function handleAbandon(matchNumber) {
    if (!token) { handleAuthFailure(); return; }
    try {
      const res = await fetch(`/api/tournaments/${id}/matches/${matchNumber}/abandon`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401) { handleAuthFailure(); return; }
      if (!res.ok) { alert(data.error || 'Failed to abandon match'); return; }
      setT(data.tournament);
    } catch { alert('Network error'); }
  }

  async function handleDisqualify(player, action) {
    if (!token) { handleAuthFailure(); return; }
    setDisqualifyError('');
    setDisqualifyLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/disqualify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ player, action }),
      });
      const data = await res.json();
      if (res.status === 401) { handleAuthFailure(); return; }
      if (!res.ok) { setDisqualifyError(data.error || 'Failed'); return; }
      setT(data.tournament);
      setDisqualifyPlayer('');
    } catch { setDisqualifyError('Network error'); }
    finally { setDisqualifyLoading(false); }
  }

  async function handleAdvance() {
    if (!token) {
      handleAuthFailure();
      return;
    }

    setAdvanceError(''); setAdvancing(null); setPendingTiebreaks([]);
    try {
      const res = await fetch(`/api/tournaments/${id}/advance`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401) {
        handleAuthFailure();
        return;
      }
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
    if (!token) {
      handleAuthFailure();
      return;
    }

    try {
      const res = await fetch(`/api/tournaments/${id}/set-next-format`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nextFormat, numberOfGroups }),
      });
      const data = await res.json();
      if (res.status === 401) {
        handleAuthFailure();
        return;
      }
      if (!res.ok) { setAdvanceError(data.error || 'Failed to set format'); return; }
      setAdvancing(null); setT(data);
    } catch { setAdvanceError('Network error'); }
  }

  async function handleTiebreak(tb, selected) {
    if (!token) {
      handleAuthFailure();
      return;
    }

    try {
      const res = await fetch(`/api/tournaments/${id}/tiebreak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stageNumber: tb.stageNumber, groupId: tb.groupId, selected }),
      });
      const data = await res.json();
      if (res.status === 401) {
        handleAuthFailure();
        return;
      }
      if (!res.ok) { alert(data.error || 'Failed to resolve tiebreak'); return; }
      setPendingTiebreaks(prev => prev.filter(x => x.groupId !== tb.groupId));
      fetchT();
    } catch { alert('Network error'); }
  }

  async function handleRenamePlayer() {
    const oldName = renameFrom.trim();
    const newName = renameTo.trim();

    setRenameError('');
    if (!oldName) {
      setRenameError('Select a player to rename.');
      return;
    }
    if (!newName) {
      setRenameError('Enter a new player name.');
      return;
    }
    if (oldName === newName) {
      setRenameError('New name must be different.');
      return;
    }

    if (!token) {
      handleAuthFailure();
      return;
    }

    setRenameLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oldName, newName }),
      });
      const data = await res.json();
      if (res.status === 401) {
        handleAuthFailure();
        return;
      }
      if (!res.ok) {
        setRenameError(data.error || 'Failed to rename player');
        return;
      }

      setT(data.tournament);
      setRenameFrom('');
      setRenameTo('');
    } catch {
      setRenameError('Network error');
    } finally {
      setRenameLoading(false);
    }
  }

  // ── Computed data ─────────────────────────────────────────────────────────
  const currentStage = useMemo(() => t?.stages?.[t.currentStageIndex], [t]);

  useEffect(() => {
    if (!currentStage) {
      if (lastInitializedStageRef.current !== null) {
        setSelectedGroupId('all');
        lastInitializedStageRef.current = null;
      }
      return;
    }
    // Only reset when the stage actually advances, not on every poll refresh
    if (lastInitializedStageRef.current === currentStage.stageNumber) return;
    lastInitializedStageRef.current = currentStage.stageNumber;
    if (currentStage.type !== 'group') {
      setSelectedGroupId('all');
      return;
    }
    setSelectedGroupId('all');
  }, [currentStage]);

  const normalizedPlayerFilter = useMemo(() => playerFilter.trim().toLowerCase(), [playerFilter]);

  const matchPassesFilter = useCallback((match) => {
    if (!normalizedPlayerFilter) return true;
    const p1 = (match.player1 || '').toLowerCase();
    const p2 = (match.player2 || '').toLowerCase();
    return p1.includes(normalizedPlayerFilter) || p2.includes(normalizedPlayerFilter);
  }, [normalizedPlayerFilter]);

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

  const filteredStageMatchesByRound = useMemo(
    () => stageMatchesByRound
      .map(rr => ({ ...rr, matches: rr.matches.filter(matchPassesFilter) }))
      .filter(rr => rr.matches.length > 0),
    [stageMatchesByRound, matchPassesFilter]
  );

  const totalFilteredCurrentStageMatches = useMemo(() => {
    if (!currentStage || !t) return 0;
    if (currentStage.type === 'group') {
      return currentStage.groups.reduce((sum, group) => {
        const gm = t.matches.filter(m => m.groupId === group.groupId);
        return sum + gm.filter(matchPassesFilter).length;
      }, 0);
    }
    return filteredStageMatchesByRound.reduce((sum, rr) => sum + rr.matches.length, 0);
  }, [currentStage, t, filteredStageMatchesByRound, matchPassesFilter]);

  const roundStatus = useMemo(() => stageMatchesByRound.map(rr => ({
    round: rr.round, total: rr.matches.length,
    done: rr.matches.filter(m => m.status === 'completed' || m.status === 'abandoned').length,
  })), [stageMatchesByRound]);

  const allCurrentMatchesDone = useMemo(() => {
    if (!t || !currentStage) return false;
    if (currentStage.type === 'group') {
      const gIds = new Set(currentStage.groups.map(g => g.groupId));
      const gms = t.matches.filter(m => gIds.has(m.groupId));
      return gms.length > 0 && gms.every(m => m.status === 'completed' || m.status === 'abandoned');
    }
    const perGroup = currentStage.playerCount || 2;
    const span = currentStage.type === 'round-robin' ? Math.max(perGroup - 1, 1) : 1;
    const start = currentStage.round, end = start + span - 1;
    const sms = t.matches.filter(m => m.round >= start && m.round <= end);
    return sms.length > 0 && sms.every(m => m.status === 'completed' || m.status === 'abandoned');
  }, [t, currentStage]);

  const previousStages = useMemo(() => t ? t.stages.slice(0, t.currentStageIndex) : [], [t]);
  const renameHistory = useMemo(
    () => (t?.renameHistory || []).slice().sort((a, b) => new Date(b.renamedAt) - new Date(a.renamedAt)),
    [t]
  );

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-[#f4f8ec] via-[#fbfaf5] to-[#ece7de]">
      <Navbar />
      <div className="py-12 text-center text-gray-400">Loading tournament...</div>
    </div>
  );

  if (!t) return (
    <div className="min-h-screen bg-gradient-to-br from-[#f4f8ec] via-[#fbfaf5] to-[#ece7de]">
      <Navbar />
      <div className="py-12 text-center text-red-500">Tournament not found.</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f4f8ec] via-[#fbfaf5] to-[#ece7de]">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4">
        <div className="py-8 space-y-6">
          {/* Header */}
          <div>
            <Link href="/" className="text-[#4F772D] text-sm font-medium hover:underline">← All Tournaments</Link>
            <div className="flex items-start justify-between mt-2 flex-wrap gap-2">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{t.name}</h1>
                <p className="text-[#6d655d] mt-1 text-base">
                  <span className="capitalize">{t.initialFormat === 'group' ? 'Group Stage' : 'Round Robin'}</span>
                  {' · '}{t.players.length} players{' · '}
                  <span className={`font-semibold ${t.status === 'completed' ? 'text-[#4F772D]' : t.status === 'in-progress' ? 'text-[#7D6D61]' : 'text-[#6d655d]'}`}>
                    {t.status === 'completed' ? 'Completed' : t.status === 'in-progress' ? 'In Progress' : t.status}
                  </span>
                </p>
              </div>
              {t.status === 'completed' && t.champion && (
                <div className="flex items-center gap-2 bg-[#f7f1dc] border border-[#d8c68a] rounded-xl px-4 py-2 shadow-sm">
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
                <span className={`text-sm px-2 py-1 rounded-full font-medium ${i === t.currentStageIndex ? 'bg-[#4F772D] text-white' : s.status === 'completed' ? 'bg-[#e9f2da] text-[#35531f]' : 'bg-[#ece8e0] text-[#7D6D61]'}`}>
                  {s.label}
                </span>
                {i < t.stages.length - 1 && <ChevronRight className="w-3 h-3 text-[#a4968b]" />}
              </div>
            ))}
            {advancing && (
              <>
                <ChevronRight className="w-3 h-3 text-[#a4968b]" />
                <span className="text-sm px-2 py-1 rounded-full bg-[#f4ede7] text-[#7D6D61] font-medium animate-pulse">Choose Next Stage...</span>
              </>
            )}
          </div>

          {currentStage && (
            <div className="sticky top-[68px] z-30 rounded-2xl border border-[#d7dfc8] bg-[#fbfcf7]/95 p-3 shadow-[0_10px_30px_rgba(19,42,19,0.06)] backdrop-blur supports-[backdrop-filter]:bg-[#fbfcf7]/88 sm:p-4">
              <div className="space-y-3">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7D6D61]">Round Status</p>
                    <span className="text-xs font-medium text-[#4F772D]">{currentStage.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {roundStatus.map(rs => {
                      const isComplete = rs.done === rs.total;
                      return (
                        <div
                          key={rs.round}
                          className={`rounded-xl border px-3 py-2 ${isComplete ? 'border-[#b9cb92] bg-[#eef5df] text-[#264017]' : 'border-[#e2d7cc] bg-[#faf5f0] text-[#7D6D61]'}`}
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-wide">Round {rs.round}</p>
                          <p className="mt-1 text-base font-bold">{rs.done}/{rs.total}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-start">
                  <div>
                    <label className="block text-sm font-semibold text-[#314b24] mb-1">Find Matches By Player</label>
                    <input
                      value={playerFilter}
                      onChange={e => setPlayerFilter(e.target.value)}
                      placeholder="Type a player name"
                      className={fieldClassName}
                    />
                  </div>
                  <div className="text-sm text-[#6d655d] lg:text-right pt-0.5">
                    Showing <span className="font-semibold text-[#4F772D]">{totalFilteredCurrentStageMatches}</span> match{totalFilteredCurrentStageMatches === 1 ? '' : 'es'}
                  </div>
                </div>
              </div>
              {currentStage.type === 'group' && currentStage.groups.length > 1 && (
                <div className="mt-3 border-t border-[#e7eadf] pt-3">
                  <p className="text-sm font-semibold text-[#314b24] mb-2">Jump To Group</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedGroupId('all')}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${selectedGroupId === 'all' ? 'bg-[#4F772D] text-white border-[#4F772D]' : 'bg-white border-[#c7d1b2] text-[#314b24] hover:border-[#90A955]'}`}
                    >
                      All Groups
                    </button>
                    {currentStage.groups.map(group => (
                      <button
                        key={group.groupId}
                        type="button"
                        onClick={() => setSelectedGroupId(group.groupId)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${selectedGroupId === group.groupId ? 'bg-[#4F772D] text-white border-[#4F772D]' : 'bg-white border-[#c7d1b2] text-[#314b24] hover:border-[#90A955]'}`}
                      >
                        {group.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rename history — admin only */}
          {token && (
          <details className="bg-[#f7f8f3] rounded-xl border border-[#dde4cf]">
            <summary className="px-5 py-3 font-semibold cursor-pointer text-[#5f554d] text-base">
              Rename History ({renameHistory.length})
            </summary>
            <div className="px-5 pb-5">
              {renameHistory.length === 0 ? (
                <p className="text-sm text-gray-500">No player renames yet.</p>
              ) : (
                <div className="space-y-2">
                  {renameHistory.map((entry, idx) => (
                    <div key={`${entry.oldName}-${entry.newName}-${entry.renamedAt}-${idx}`} className="bg-white border border-[#e1e7d5] rounded-lg px-3 py-2 text-base">
                      <p className="text-gray-800">
                        <span className="font-semibold">{entry.oldName}</span> → <span className="font-semibold">{entry.newName}</span>
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {new Date(entry.renamedAt).toLocaleString()}
                        {entry.renamedBy ? ` by ${entry.renamedBy}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
          )}

          {token && t.status !== 'completed' && (
            <div className="bg-white rounded-xl shadow-sm border border-[#dde4cf] p-4">
              <h3 className="text-base font-bold text-[#314b24] mb-3">Update Player Name</h3>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Current Name</label>
                  <select
                    value={renameFrom}
                    onChange={e => setRenameFrom(e.target.value)}
                    className={fieldClassName}
                  >
                    <option value="">Select player</option>
                    {t.players.map(player => (
                      <option key={player} value={player}>{player}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">New Name</label>
                  <input
                    value={renameTo}
                    onChange={e => setRenameTo(e.target.value)}
                    placeholder="Enter new name"
                    className={fieldClassName}
                  />
                </div>
                <button
                  onClick={handleRenamePlayer}
                  disabled={renameLoading}
                  className="h-11 bg-[#4F772D] text-white px-4 rounded-xl text-base font-medium hover:bg-[#3e5e23] disabled:opacity-50"
                >
                  {renameLoading ? 'Updating...' : 'Update Name'}
                </button>
              </div>
              {renameError && <p className="text-red-600 text-base mt-2">{renameError}</p>}
            </div>
          )}

          {/* Disqualify Player — admin only */}
          {token && t.status !== 'completed' && (
            <div className="bg-white rounded-xl shadow-sm border border-red-100 p-4">
              <h3 className="text-base font-bold text-[#314b24] mb-3 flex items-center gap-2">
                <UserX className="w-4 h-4 text-red-500" /> Disqualify / Reinstate Player
              </h3>
              {(t.disqualifiedPlayers || []).length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {(t.disqualifiedPlayers || []).map(p => (
                    <span key={p} className="flex items-center gap-1 bg-red-100 text-red-700 text-sm px-3 py-1 rounded-full font-medium">
                      <UserX className="w-3 h-3" /> {p}
                      <button
                        onClick={() => handleDisqualify(p, 'reinstate')}
                        className="ml-1 hover:text-red-900 font-bold"
                        title="Reinstate"
                      >×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-sm text-gray-500 mb-1">Select Player to Disqualify</label>
                  <select
                    value={disqualifyPlayer}
                    onChange={e => setDisqualifyPlayer(e.target.value)}
                    className={fieldClassName}
                  >
                    <option value="">Select player</option>
                    {t.players
                      .filter(p => !(t.disqualifiedPlayers || []).includes(p))
                      .map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                  </select>
                </div>
                <button
                  onClick={() => disqualifyPlayer && handleDisqualify(disqualifyPlayer, 'disqualify')}
                  disabled={!disqualifyPlayer || disqualifyLoading}
                  className="h-11 bg-red-600 text-white px-4 rounded-xl text-base font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {disqualifyLoading ? 'Updating...' : 'Disqualify'}
                </button>
              </div>
              {disqualifyError && <p className="text-red-600 text-base mt-2">{disqualifyError}</p>}
            </div>
          )}

          {/* Current Stage */}
          {currentStage && t.status !== 'completed' && (
            <div className="bg-white rounded-2xl shadow-sm border border-[#dde4cf] p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${stageBadgeColor(currentStage.type)}`}>
                    {currentStage.type === 'group' ? 'Group Stage' : currentStage.type === 'round-robin' ? 'Round Robin' : 'Knockout'}
                  </span>
                  <h2 className="text-xl font-bold text-[#132A13]">{currentStage.label}</h2>
                </div>
                <div className="text-sm text-[#7D6D61]">Live stage view</div>
              </div>

              {/* Group Stage */}
              {currentStage.type === 'group' && (
                <div className="space-y-8">
                  {currentStage.groups
                    .filter(group => selectedGroupId === 'all' || selectedGroupId === group.groupId)
                    .map(group => {
                    const groupMatches = t.matches.filter(m => m.groupId === group.groupId);
                    const filteredGroupMatches = groupMatches.filter(matchPassesFilter);
                    const groupStandings = (t.standings || []).filter(s => s.groupId === group.groupId);
                    const groupByRound = {};
                    for (const m of filteredGroupMatches) {
                      groupByRound[m.round] = groupByRound[m.round] || [];
                      groupByRound[m.round].push(m);
                    }
                    return (
                      <div key={group.groupId}>
                        <h3 className="text-lg font-bold text-[#35531f] mb-3 border-b border-[#e3e8d7] pb-2">{group.name}</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div>
                            <p className="text-base font-semibold text-[#5f554d] mb-2">Matches</p>
                            <div className="space-y-4">
                              {Object.keys(groupByRound).length > 0 ? (
                                Object.keys(groupByRound).sort((a, b) => a - b).map(r => (
                                  <div key={r}>
                                    <p className="text-sm text-[#a4968b] font-semibold mb-1 uppercase">Matchday {Number(r) - group.round + 1}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {groupByRound[r].map(m => (
                                        <MatchCard key={m.matchNumber} match={m} token={token} onResult={handleResult} onUpdate={handleUpdateResult} onAbandon={handleAbandon} disqualifiedPlayers={t.disqualifiedPlayers} />
                                      ))}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-[#6d655d] bg-[#f7f8f3] border border-[#dde4cf] rounded-lg px-3 py-2">
                                  No matches found for this filter in {group.name}.
                                </p>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-base font-semibold text-[#5f554d] mb-2">Standings</p>
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
                  {filteredStageMatchesByRound.map(rr => (
                    <div key={rr.round}>
                      {currentStage.type === 'round-robin' && (
                        <p className="text-base text-[#7D6D61] font-semibold mb-2 uppercase">
                          Matchday {rr.round - currentStage.round + 1}
                          {roundStatus.find(rs => rs.round === rr.round)?.done === roundStatus.find(rs => rs.round === rr.round)?.total
                            ? <span className="text-[#4F772D] ml-2">✓ Complete</span> : null}
                        </p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {rr.matches.map(m => <MatchCard key={m.matchNumber} match={m} token={token} onResult={handleResult} onUpdate={handleUpdateResult} onAbandon={handleAbandon} disqualifiedPlayers={t.disqualifiedPlayers} />)}
                      </div>
                    </div>
                  ))}
                  {filteredStageMatchesByRound.length === 0 && (
                    <p className="text-base text-[#6d655d] bg-[#f7f8f3] border border-[#dde4cf] rounded-lg px-3 py-2">
                      No matches found for this player filter in this stage.
                    </p>
                  )}
                  {currentStage.type === 'round-robin' && t.standings?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-base font-semibold text-[#5f554d] mb-2">Standings</p>
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
                  ${allCurrentMatchesDone ? 'bg-[#4F772D] hover:bg-[#3e5e23] shadow-md hover:shadow-lg' : 'bg-gray-300 cursor-not-allowed text-gray-500'}`}
              >
                <ChevronRight className="w-5 h-5" />
                {allCurrentMatchesDone ? 'Advance to Next Round' : 'Complete all matches to advance'}
              </button>
              {!allCurrentMatchesDone && (
                <p className="text-sm text-[#6d655d]">All matches in the current stage must be completed before advancing.</p>
              )}
              {advanceError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-base max-w-lg">
                  {advanceError}
                </div>
              )}
            </div>
          )}

          {/* Previous stages — always visible for public progression tracking */}
          {previousStages.length > 0 && (
            <div className="bg-[#f7f8f3] rounded-xl border border-[#dde4cf]">
              <div className="px-5 py-3 border-b border-[#dde4cf]">
                <h3 className="font-semibold text-[#5f554d] text-base">Previous Stages ({previousStages.length})</h3>
              </div>
              <div className="px-5 pb-5 pt-4 space-y-6">
                {previousStages.map(stage => {
                  const stageMs = stage.type === 'group'
                    ? t.matches.filter(m => stage.groups.some(g => g.groupId === m.groupId))
                    : t.matches.filter(m => m.round === stage.round);
                  return (
                    <div key={stage.stageNumber}>
                      <h3 className="text-base font-bold text-[#314b24] mb-2 border-b border-[#e1e7d5] pb-1">
                        {stage.label} <span className="text-[#4F772D] text-sm ml-1">✓ Completed</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {stageMs.map(m => (
                          <div key={m.matchNumber} className={`text-sm border rounded-lg p-2 ${m.status === 'abandoned' ? 'bg-red-50 border-red-200' : 'bg-white border-[#dfe6d2]'}`}>
                            {m.status === 'abandoned' ? (
                              <div className="text-center text-red-600 font-semibold py-1">
                                <p>{m.player1} vs {m.player2}</p>
                                <p className="text-xs mt-0.5">Abandoned (−2 pts each)</p>
                              </div>
                            ) : (
                              <>
                                <div className={`grid grid-cols-[minmax(0,1fr)_3rem_1.25rem] items-center gap-2 ${m.winner === m.player1 ? 'font-bold text-[#35531f]' : 'text-gray-600'}`}>
                                  <span className="min-w-0">{m.player1}</span>
                                  <span className="text-center">{m.player1Score}</span>
                                  <span className="flex justify-end">{m.winner === m.player1 ? <Medal className="w-4 h-4 text-yellow-500" /> : null}</span>
                                </div>
                                <div className="text-center text-gray-300 text-sm">—</div>
                                <div className={`grid grid-cols-[minmax(0,1fr)_3rem_1.25rem] items-center gap-2 ${m.winner === m.player2 ? 'font-bold text-[#35531f]' : 'text-gray-600'}`}>
                                  <span className="min-w-0">{m.player2}</span>
                                  <span className="text-center">{m.player2Score}</span>
                                  <span className="flex justify-end">{m.winner === m.player2 ? <Medal className="w-4 h-4 text-yellow-500" /> : null}</span>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {t.status === 'completed' && (
            <div className="bg-gradient-to-r from-[#f7f1dc] to-[#f4ead1] border border-[#d8c68a] rounded-xl p-8 text-center shadow-sm">
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
