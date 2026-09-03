'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trophy, Medal, ChevronRight, ChevronDown, AlertTriangle, CheckCircle, Pencil, Ban, UserX, ArrowLeft, Search, ShieldCheck, Check, Clock, Swords, Sparkles } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { clearAdminToken, getStoredAdminToken } from '@/lib/clientAuth';
import useTournamentStream from '@/hooks/useTournamentStream';

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
  if (type === 'group') return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
  if (type === 'round-robin') return 'bg-sky-50 text-sky-800 border border-sky-200';
  if (type === 'knockout') return 'bg-amber-50 text-amber-800 border border-amber-200';
  return 'bg-slate-100 text-slate-700 border border-slate-200';
}

const fieldClassName = 'w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500';
const smallScoreInputClassName = 'w-12 h-9 rounded-lg border border-slate-300 bg-white text-center text-sm font-extrabold text-slate-900 shadow-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500';
const primaryButtonClassName = 'bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-50 transition-all';

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
    <div className="flex gap-2 items-center">
      <input
        type="number" min={0} value={p1} onChange={e => setP1(e.target.value)}
        placeholder="0" className={smallScoreInputClassName}
      />
      <span className="text-slate-400 font-bold">—</span>
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
    <div className={`rounded-2xl border p-4 transition-all duration-200 ${
      isAbandoned ? 'bg-red-50/60 border-red-200' :
      isCompleted ? 'bg-white border-slate-200/90 shadow-sm hover:shadow-md' :
      'bg-slate-50/60 border-slate-200/80 hover:bg-white hover:shadow-sm'
    }`}>
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider tabular-nums">
          Match #{match.matchNumber}
        </span>
        {isCompleted && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> Final
          </span>
        )}
        {isAbandoned && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100/80 px-2 py-0.5 rounded-full border border-red-200">
            <Ban className="w-3 h-3" /> Abandoned
          </span>
        )}
        {!isCompleted && !isAbandoned && (
          <span className="text-[11px] font-semibold text-slate-400">Upcoming</span>
        )}
      </div>

      <div className="space-y-1.5">
        {/* Player 1 Row */}
        <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 transition-colors ${
          isCompleted && match.winner === match.player1
            ? 'bg-emerald-50/90 border border-emerald-200/70'
            : 'bg-white border border-slate-100'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {isCompleted && match.winner === match.player1 && (
              <Medal className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <span className={`truncate text-sm font-semibold ${
              isCompleted && match.winner === match.player1 ? 'text-emerald-950 font-bold' :
              isAbandoned ? 'text-red-700' :
              dq.has(match.player1) ? 'text-slate-400 line-through' : 'text-slate-800'
            }`}>
              {match.player1 || 'TBD'}
              {dq.has(match.player1) && <span className="ml-1.5 text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded no-underline">DQ</span>}
            </span>
          </div>

          <span className={`tabular-nums font-black text-base px-2.5 py-0.5 rounded-lg ${
            isCompleted && match.winner === match.player1 ? 'bg-emerald-600 text-white shadow-xs' :
            isCompleted ? 'bg-slate-100 text-slate-700' : 'text-slate-300'
          }`}>
            {isCompleted && match.player1Score != null ? match.player1Score : '—'}
          </span>
        </div>

        {/* Player 2 Row */}
        <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 transition-colors ${
          isCompleted && match.winner === match.player2
            ? 'bg-emerald-50/90 border border-emerald-200/70'
            : 'bg-white border border-slate-100'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {isCompleted && match.winner === match.player2 && (
              <Medal className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <span className={`truncate text-sm font-semibold ${
              isCompleted && match.winner === match.player2 ? 'text-emerald-950 font-bold' :
              isAbandoned ? 'text-red-700' :
              dq.has(match.player2) ? 'text-slate-400 line-through' : 'text-slate-800'
            }`}>
              {match.player2 || 'TBD'}
              {dq.has(match.player2) && <span className="ml-1.5 text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded no-underline">DQ</span>}
            </span>
          </div>

          <span className={`tabular-nums font-black text-base px-2.5 py-0.5 rounded-lg ${
            isCompleted && match.winner === match.player2 ? 'bg-emerald-600 text-white shadow-xs' :
            isCompleted ? 'bg-slate-100 text-slate-700' : 'text-slate-300'
          }`}>
            {isCompleted && match.player2Score != null ? match.player2Score : '—'}
          </span>
        </div>
      </div>

      {isDraw && (
        <p className="text-center text-xs font-semibold text-slate-500 bg-slate-100/70 rounded-lg py-1 mt-2">
          Match Drawn
        </p>
      )}
      {isAbandoned && (
        <p className="text-center text-xs font-semibold text-red-600 bg-red-100/60 rounded-lg py-1 mt-2">
          −2 points penalty to each player
        </p>
      )}

      {token && !isCompleted && !isAbandoned && match.player1 && match.player2 && (
        <div className="space-y-2 mt-3 pt-3 border-t border-slate-100">
          <ScoreForm onSubmit={handleScore} loading={saving} />
          <button
            onClick={handleAbandonClick}
            disabled={abandoning}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 hover:border-red-300 border border-transparent flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Ban className="w-3.5 h-3.5" /> {abandoning ? 'Abandoning...' : 'Abandon Match'}
          </button>
        </div>
      )}

      {token && isCompleted && match.player1 && match.player2 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-400" /> Edit Result
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
                <span className="text-slate-400 font-bold">—</span>
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
                  className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-200 disabled:opacity-50 transition-colors"
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
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {title && (
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h4>
          {showAdvancing && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Top {advancingCount} Advance
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/90 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200/80">
              <th className="px-3 py-2.5 w-12 text-center">#</th>
              <th className="px-3 py-2.5">Competitor</th>
              <th className="px-2.5 py-2.5 text-center">P</th>
              <th className="px-2.5 py-2.5 text-center">W</th>
              <th className="px-2.5 py-2.5 text-center">D</th>
              <th className="px-2.5 py-2.5 text-center">L</th>
              <th className="px-2.5 py-2.5 text-center">GF</th>
              <th className="px-2.5 py-2.5 text-center">GA</th>
              <th className="px-2.5 py-2.5 text-center">GD</th>
              <th className="px-3 py-2.5 text-center font-extrabold text-slate-800">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((s, i) => {
              const isQualifying = showAdvancing && i < advancingCount && s.points > 0;
              const gd = s.goalsFor - s.goalsAgainst;

              return (
                <tr
                  key={s.player}
                  className={`transition-colors hover:bg-slate-50/70 ${
                    isQualifying ? 'bg-emerald-50/35 font-medium' : ''
                  }`}
                >
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold tabular-nums ${
                      isQualifying
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : i === 0 && anyPlayed
                        ? 'bg-amber-100 text-amber-800'
                        : 'text-slate-400 bg-slate-100'
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      {isQualifying && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                      <span className="truncate max-w-[14rem] sm:max-w-none">{s.player}</span>
                    </div>
                  </td>
                  <td className="px-2.5 py-2.5 text-center text-slate-600 tabular-nums">{s.played}</td>
                  <td className="px-2.5 py-2.5 text-center text-slate-600 tabular-nums">{s.wins}</td>
                  <td className="px-2.5 py-2.5 text-center text-slate-600 tabular-nums">{s.draws}</td>
                  <td className="px-2.5 py-2.5 text-center text-slate-600 tabular-nums">{s.losses}</td>
                  <td className="px-2.5 py-2.5 text-center text-slate-500 tabular-nums">{s.goalsFor}</td>
                  <td className="px-2.5 py-2.5 text-center text-slate-500 tabular-nums">{s.goalsAgainst}</td>
                  <td className={`px-2.5 py-2.5 text-center tabular-nums font-semibold ${
                    gd > 0 ? 'text-emerald-700' : gd < 0 ? 'text-rose-600' : 'text-slate-400'
                  }`}>
                    {gd > 0 ? `+${gd}` : gd}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums font-black text-emerald-800 text-base">
                    {s.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showAdvancing && (
        <div className="px-4 py-2 bg-emerald-50/60 border-t border-emerald-100 text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Green indicators signify current knockout qualification zone.</span>
        </div>
      )}
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
    <div className="bg-white border-2 border-emerald-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
          ⚡
        </div>
        <h3 className="font-bold text-lg text-slate-900">Configure Next Stage Format</h3>
      </div>
      <p className="text-sm text-slate-600 mb-4">
        <strong className="text-emerald-700">{advancing.length} competitors</strong> have qualified. Select the progression format:
      </p>

      <div className="flex flex-wrap gap-1.5 mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-full mb-1">Qualifiers:</span>
        {advancing.map(p => (
          <span key={p} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700">
            {p}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <button
          type="button"
          onClick={() => setNextFormat('knockout')}
          className={`p-4 rounded-2xl border-2 text-left transition-all ${
            nextFormat === 'knockout'
              ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <div className="font-bold text-base text-slate-900 mb-1">⚡ Knockout</div>
          <div className="text-xs text-slate-500">Single elimination bracket. Winners advance directly to final.</div>
        </button>

        <button
          type="button"
          onClick={() => setNextFormat('round-robin')}
          className={`p-4 rounded-2xl border-2 text-left transition-all ${
            nextFormat === 'round-robin'
              ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <div className="font-bold text-base text-slate-900 mb-1">🔄 Round Robin</div>
          <div className="text-xs text-slate-500">All qualifiers play each other. Top 50% advance to final bracket.</div>
        </button>

        {validGroupCounts.length > 0 && (
          <button
            type="button"
            onClick={() => setNextFormat('group')}
            className={`p-4 rounded-2xl border-2 text-left transition-all ${
              nextFormat === 'group'
                ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="font-bold text-base text-slate-900 mb-1">🏆 Secondary Groups</div>
            <div className="text-xs text-slate-500">Split into balanced groups with round-robin fixtures.</div>
          </button>
        )}
      </div>

      {nextFormat === 'group' && (
        <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Select Number of Groups
          </label>
          <div className="flex flex-wrap gap-2">
            {validGroupCounts.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setNumberOfGroups(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  Number(numberOfGroups) === n
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                {n} Groups (~{Math.ceil(advancing.length / n)} each)
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm mb-4 font-medium flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" /> {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        className="theme-primary-btn shadow-md"
      >
        Confirm Format &amp; Build Stage <ChevronRight className="w-4 h-4" />
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
    <div className="bg-amber-50/70 border-2 border-amber-200 rounded-3xl p-6 shadow-sm mb-6">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <h4 className="font-bold text-slate-900 text-base">Tiebreak Required — {tiebreak.groupId}</h4>
      </div>
      <p className="text-sm text-slate-600 mb-4">
        Points, goal difference, and goals scored are identical. Select exactly <strong className="text-slate-900">{tiebreak.requiredCount}</strong> competitor(s) to advance:
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {tiebreak.candidates.map(p => {
          const isSelected = selected.includes(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => toggle(p)}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                  : 'bg-white border border-slate-300 text-slate-700 hover:border-slate-400'
              }`}
            >
              {p} {isSelected ? '✓' : ''}
            </button>
          );
        })}
      </div>
      <button
        disabled={selected.length !== tiebreak.requiredCount}
        onClick={() => onResolve(tiebreak, selected)}
        className="theme-primary-btn text-sm disabled:opacity-50"
      >
        Confirm Selections ({selected.length}/{tiebreak.requiredCount})
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

  const handleTournamentSnapshot = useCallback((snapshot) => {
    if (snapshot && typeof snapshot === 'object' && snapshot.stages && snapshot.matches) {
      setT(snapshot);
    }
  }, []);

  const fetchT = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${id}`);
      const data = await res.json();
      setT(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id]);

  const { isConnected: isLive, isReconnecting } = useTournamentStream(id, {
    onTournamentUpdate: handleTournamentSnapshot,
    onEvent: (parsed) => {
      // If event did not supply a complete snapshot, fallback to fresh fetch
      const snapshot = parsed?.tournament || parsed?.data?.tournament;
      if (!snapshot || !snapshot.stages || !snapshot.matches) {
        fetchT();
      }
    },
  });

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

  useEffect(() => {
    fetchT();
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

  if (loading) {
    return (
      <div className="app-shell">
        <Navbar />
        <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse-subtle" />
          <div className="space-y-2">
            <div className="h-9 w-2/5 bg-slate-200 rounded-xl animate-pulse-subtle" />
            <div className="h-5 w-1/4 bg-slate-100 rounded-lg animate-pulse-subtle" />
          </div>
          <div className="h-10 w-full max-w-md bg-slate-100 rounded-2xl animate-pulse-subtle" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-36 bg-white rounded-2xl border border-slate-200/80 p-4 animate-pulse-subtle" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!t) {
    return (
      <div className="app-shell">
        <Navbar />
        <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 flex items-center justify-center py-20">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-10 max-w-md w-full text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tournament Not Found</h1>
            <p className="text-slate-500 text-sm mt-2 mb-6">
              The tournament ID could not be located in the system database.
            </p>
            <Link href="/" className="theme-primary-btn w-full shadow-sm">
              <ArrowLeft className="w-4 h-4" /> Return to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Tournament Header */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/80 transition-all hover:bg-emerald-100 mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {t.initialFormat === 'group' ? 'Group Stage' : 'Round Robin'}
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-semibold text-slate-600 tabular-nums">
                  {t.players.length} Competitors
                </span>
                <span className="text-xs text-slate-400">·</span>
                {t.status === 'in-progress' && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    In Progress
                  </span>
                )}
                {t.status === 'completed' && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    Completed
                  </span>
                )}
                {isLive && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200" title="Live stream connected">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                )}
                {isReconnecting && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" title="Reconnecting to real-time stream">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Reconnecting...
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                {t.name}
              </h1>
            </div>

            {t.status === 'completed' && t.champion && (
              <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-yellow-100 border border-amber-300/80 rounded-2xl px-5 py-3 shadow-sm self-start md:self-auto">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Tournament Champion</span>
                  <span className="text-lg font-black text-amber-950">{t.champion}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stage Pipeline Stepper */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Competition Pipeline
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {t.stages.map((s, i) => {
              const isCurrent = i === t.currentStageIndex && t.status !== 'completed';
              const isDone = s.status === 'completed' || t.status === 'completed';

              return (
                <div key={i} className="flex items-center gap-2 shrink-0">
                  <div
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/50'
                        : isDone
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span>{i + 1}. {s.label}</span>
                    {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  </div>
                  {i < t.stages.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                </div>
              );
            })}

            {advancing && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                <div className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                  Selecting Next Stage...
                </div>
              </>
            )}
          </div>
        </div>

        {/* Player Search & Group Filter Bar */}
        {currentStage && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  value={playerFilter}
                  onChange={e => setPlayerFilter(e.target.value)}
                  placeholder="Filter fixtures by player name..."
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all"
                />
              </div>
              <div className="text-xs font-semibold text-slate-500">
                Showing <strong className="text-emerald-700 tabular-nums">{totalFilteredCurrentStageMatches}</strong> match{totalFilteredCurrentStageMatches === 1 ? '' : 'es'}
              </div>
            </div>

            {currentStage.type === 'group' && currentStage.groups.length > 1 && (
              <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Groups:</span>
                <button
                  type="button"
                  onClick={() => setSelectedGroupId('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedGroupId === 'all'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Groups
                </button>
                {currentStage.groups.map(group => (
                  <button
                    key={group.groupId}
                    type="button"
                    onClick={() => setSelectedGroupId(group.groupId)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      selectedGroupId === group.groupId
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Administration & Player Management (Collapsible for Clean UX) */}
        {token && t.status !== 'completed' && (
          <details className="group bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <summary className="px-6 py-4 font-bold text-slate-800 cursor-pointer flex items-center justify-between hover:bg-slate-50/60 transition-colors">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-bold text-slate-900">
                  Tournament Administration &amp; Roster Controls
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
            </summary>

            <div className="p-6 pt-3 border-t border-slate-100 space-y-6 bg-slate-50/40">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Rename Player Box */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-slate-500" /> Rename Competitor
                  </h4>
                  <p className="text-xs text-slate-500">
                    Updates player across all tournament stages, fixtures, and standings history.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Current Name</label>
                    <select
                      value={renameFrom}
                      onChange={e => setRenameFrom(e.target.value)}
                      className={fieldClassName}
                    >
                      <option value="">Select player to rename</option>
                      {t.players.map(player => (
                        <option key={player} value={player}>{player}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">New Name</label>
                    <input
                      value={renameTo}
                      onChange={e => setRenameTo(e.target.value)}
                      placeholder="Enter new competitor name"
                      className={fieldClassName}
                    />
                  </div>
                  {renameError && <p className="text-red-600 text-xs font-medium">{renameError}</p>}
                  <button
                    onClick={handleRenamePlayer}
                    disabled={renameLoading}
                    className="theme-primary-btn w-full text-xs shadow-sm"
                  >
                    {renameLoading ? 'Updating Name...' : 'Apply Rename'}
                  </button>
                </div>

                {/* Disqualify Player Box */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UserX className="w-4 h-4 text-red-500" /> Disqualify / Reinstate
                  </h4>
                  <p className="text-xs text-slate-500">
                    Disqualified players are barred from advancing and marked with a [DQ] tag.
                  </p>

                  {(t.disqualifiedPlayers || []).length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Currently Disqualified:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(t.disqualifiedPlayers || []).map(p => (
                          <span key={p} className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs px-2.5 py-1 rounded-lg font-semibold">
                            <span>{p}</span>
                            <button
                              onClick={() => handleDisqualify(p, 'reinstate')}
                              className="w-4 h-4 rounded-full bg-red-200 hover:bg-red-300 text-red-800 flex items-center justify-center font-bold text-[10px]"
                              title="Reinstate player"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Select Competitor</label>
                    <select
                      value={disqualifyPlayer}
                      onChange={e => setDisqualifyPlayer(e.target.value)}
                      className={fieldClassName}
                    >
                      <option value="">Select player to disqualify</option>
                      {t.players
                        .filter(p => !(t.disqualifiedPlayers || []).includes(p))
                        .map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                  </div>
                  {disqualifyError && <p className="text-red-600 text-xs font-medium">{disqualifyError}</p>}
                  <button
                    onClick={() => disqualifyPlayer && handleDisqualify(disqualifyPlayer, 'disqualify')}
                    disabled={!disqualifyPlayer || disqualifyLoading}
                    className="theme-danger-btn w-full text-xs shadow-sm"
                  >
                    {disqualifyLoading ? 'Updating...' : 'Disqualify Player'}
                  </button>
                </div>
              </div>

              {/* Rename History */}
              {renameHistory.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Rename Audit Trail ({renameHistory.length})
                  </h4>
                  <div className="space-y-2">
                    {renameHistory.map((entry, idx) => (
                      <div
                        key={`${entry.oldName}-${entry.newName}-${entry.renamedAt}-${idx}`}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                      >
                        <span className="font-semibold text-slate-800">
                          {entry.oldName} <span className="text-slate-400 font-normal">→</span> {entry.newName}
                        </span>
                        <span className="text-slate-400">
                          {new Date(entry.renamedAt).toLocaleDateString()} {new Date(entry.renamedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        )}

        {/* Live Stage View */}
        {currentStage && t.status !== 'completed' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${stageBadgeColor(currentStage.type)}`}>
                  {currentStage.type === 'group' ? 'Group Stage' : currentStage.type === 'round-robin' ? 'Round Robin' : 'Knockout'}
                </span>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{currentStage.label}</h2>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Stage Center
              </div>
            </div>

            {/* Group Stage Content */}
            {currentStage.type === 'group' && (
              <div className="space-y-10">
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
                      <div key={group.groupId} className="space-y-6">
                        <div className="flex items-center justify-between bg-slate-100/80 px-4 py-2.5 rounded-2xl border border-slate-200/80">
                          <h3 className="text-lg font-extrabold text-slate-900">{group.name}</h3>
                          <span className="text-xs font-semibold text-slate-500">
                            {groupMatches.length} fixtures · Top 2 advance
                          </span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                          {/* Standings Table (5 Cols on large) */}
                          <div className="lg:col-span-6">
                            <StandingsTable standings={groupStandings} title={`${group.name} Standings`} advancingCount={2} />
                          </div>

                          {/* Matches (7 Cols on large) */}
                          <div className="lg:col-span-6 space-y-4">
                            <h4 className="text-sm font-bold text-slate-900 tracking-tight px-1">Fixtures &amp; Scores</h4>
                            {Object.keys(groupByRound).length > 0 ? (
                              Object.keys(groupByRound).sort((a, b) => a - b).map(r => (
                                <div key={r} className="space-y-2">
                                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                                    Matchday {Number(r) - group.round + 1}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {groupByRound[r].map(m => (
                                      <MatchCard
                                        key={m.matchNumber}
                                        match={m}
                                        token={token}
                                        onResult={handleResult}
                                        onUpdate={handleUpdateResult}
                                        onAbandon={handleAbandon}
                                        disqualifiedPlayers={t.disqualifiedPlayers}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-500">
                                No fixtures found matching &ldquo;{playerFilter}&rdquo; in {group.name}.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Round Robin or Knockout Content */}
            {(currentStage.type === 'round-robin' || currentStage.type === 'knockout') && (
              <div className="space-y-8">
                {currentStage.type === 'round-robin' && t.standings?.length > 0 && (
                  <StandingsTable
                    standings={t.standings.filter(s => !s.groupId)}
                    title="League Standings"
                    advancingCount={currentStage.advancingCount}
                  />
                )}

                <div className="space-y-6">
                  {filteredStageMatchesByRound.map(rr => (
                    <div key={rr.round} className="space-y-3">
                      {currentStage.type === 'round-robin' && (
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Matchday {rr.round - currentStage.round + 1}
                          </span>
                          {roundStatus.find(rs => rs.round === rr.round)?.done === roundStatus.find(rs => rs.round === rr.round)?.total && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              ✓ Round Complete
                            </span>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {rr.matches.map(m => (
                          <MatchCard
                            key={m.matchNumber}
                            match={m}
                            token={token}
                            onResult={handleResult}
                            onUpdate={handleUpdateResult}
                            onAbandon={handleAbandon}
                            disqualifiedPlayers={t.disqualifiedPlayers}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  {filteredStageMatchesByRound.length === 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
                      No fixtures matching player search filter.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pending Tiebreaks */}
        {pendingTiebreaks.length > 0 && token && (
          <div className="space-y-3">
            {pendingTiebreaks.map((tb, i) => (
              <TiebreakResolver key={i} tiebreak={tb} onResolve={handleTiebreak} />
            ))}
          </div>
        )}

        {/* Awaiting Next Format Selection */}
        {advancing && token && (
          <NextFormatSelector advancing={advancing} onSubmit={handleSetNextFormat} />
        )}

        {/* Stage Advancement Action Bar */}
        {token && t.status !== 'completed' && !advancing && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Stage Progression</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {allCurrentMatchesDone
                  ? 'All matches in this stage are completed. Ready to advance to the next round.'
                  : 'All fixtures in the active stage must be scored or abandoned before progressing.'}
              </p>
              {advanceError && (
                <p className="text-xs font-semibold text-red-600 mt-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {advanceError}
                </p>
              )}
            </div>

            <button
              onClick={handleAdvance}
              disabled={!allCurrentMatchesDone}
              className={`theme-primary-btn shadow-md whitespace-nowrap self-start sm:self-auto ${
                !allCurrentMatchesDone ? 'opacity-50 cursor-not-allowed shadow-none' : ''
              }`}
            >
              <span>{allCurrentMatchesDone ? 'Advance to Next Stage' : 'Matches Incomplete'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Completed Stages History Timeline */}
        {previousStages.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" /> Completed Stages Archive ({previousStages.length})
              </h3>
              <span className="text-xs font-semibold text-slate-400">Archived Fixtures</span>
            </div>

            <div className="space-y-6">
              {previousStages.map(stage => {
                const stageMs = stage.type === 'group'
                  ? t.matches.filter(m => stage.groups.some(g => g.groupId === m.groupId))
                  : t.matches.filter(m => m.round === stage.round);

                return (
                  <div key={stage.stageNumber} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-800">{stage.label}</h4>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Concluded
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {stageMs.map(m => (
                        <div
                          key={m.matchNumber}
                          className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 text-xs flex items-center justify-between"
                        >
                          <div className="space-y-1 min-w-0 pr-2">
                            <div className={`truncate ${m.winner === m.player1 ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                              {m.player1}
                            </div>
                            <div className={`truncate ${m.winner === m.player2 ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                              {m.player2}
                            </div>
                          </div>

                          <div className="tabular-nums font-black text-right shrink-0 bg-white px-2 py-1 rounded-lg border border-slate-200/70">
                            <div>{m.player1Score ?? '—'}</div>
                            <div>{m.player2Score ?? '—'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Final Championship Celebration Showcase */}
        {t.status === 'completed' && (
          <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 border-2 border-amber-300 rounded-3xl p-8 sm:p-12 text-center shadow-md relative overflow-hidden">
            <div className="w-20 h-20 rounded-3xl bg-amber-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30 ring-8 ring-amber-100">
              <Trophy className="w-10 h-10" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-amber-800 bg-amber-200/70 px-3 py-1 rounded-full inline-block mb-3">
              Championship Concluded
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-2">
              Tournament Complete
            </h2>
            {t.champion && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-amber-800">Crowned Champion</p>
                <p className="text-3xl sm:text-4xl font-extrabold text-amber-950 mt-1">
                  🏆 {t.champion}
                </p>
              </div>
            )}
            <div className="mt-8 flex justify-center gap-3">
              <Link href="/" className="theme-secondary-btn text-sm shadow-sm bg-white">
                Back to Dashboard
              </Link>
              {token && (
                <Link href="/create" className="theme-primary-btn text-sm shadow-sm">
                  Create Next Tournament
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
