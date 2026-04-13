'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Trophy, ChevronRight, ChevronLeft, Shuffle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { clearAdminToken, getStoredAdminToken } from '@/lib/clientAuth';

const STEPS = ['Players', 'Format', 'Review'];
const fieldLabelClassName = 'block text-sm font-semibold mb-1 text-[#314b24]';

export default function CreateTournamentPage() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [playersText, setPlayersText] = useState('');
  const [format, setFormat] = useState('');
  const [numberOfGroups, setNumberOfGroups] = useState(2);
  const [randomOrder, setRandomOrder] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const t = getStoredAdminToken();
    setToken(t);
  }, []);

  const players = playersText.split('\n').map(p => p.trim()).filter(Boolean);

  if (token === null) {
    // Still hydrating — avoid flash
    return null;
  }

  if (!token) {
    return (
      <div className="app-shell">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4">
          <div className="theme-panel-soft rounded-[1.75rem] py-16 text-center theme-page-subtle">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-[#90A955]" />
            <p className="text-lg">You must be logged in as admin to create a tournament.</p>
          </div>
        </main>
      </div>
    );
  }

  function findValidGroupCounts(n) {
    const valid = [];
    for (let i = 2; i <= n / 2; i++) {
      if (n % i === 0 && n / i >= 2) valid.push(i);
    }
    return valid.slice(0, 5);
  }

  function validateStep0() {
    if (!name.trim()) return 'Tournament name is required.';
    if (players.length < 2) return 'Enter at least 2 players (one per line).';
    const dupes = new Set();
    for (const p of players) {
      if (dupes.has(p)) return `Duplicate player name: "${p}". All names must be unique.`;
      dupes.add(p);
    }
    return null;
  }

  function validateStep1() {
    if (!format) return 'Please select a tournament format.';
    if (format === 'group') {
      const ng = Number(numberOfGroups);
      if (!ng || ng < 2) return 'At least 2 groups are required.';
      if (players.length % ng !== 0) {
        return `${players.length} players cannot be equally divided into ${ng} groups. Try ${
          findValidGroupCounts(players.length).join(', ')
        } groups.`;
      }
      if (players.length / ng < 2) return 'Each group must have at least 2 players.';
    }
    return null;
  }

  function nextStep() {
    setError('');
    const err = step === 0 ? validateStep0() : validateStep1();
    if (err) { setError(err); return; }
    setStep(s => s + 1);
  }

  async function submit() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), players, format, numberOfGroups: Number(numberOfGroups), randomOrder }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/tournaments/${data._id}`);
      } else {
        if (res.status === 401) {
          clearAdminToken();
          setToken(null);
          setError('Session expired. Please login again.');
          router.push('/login');
          return;
        }
        setError(data.error || 'Failed to create tournament.');
        setStep(data.error?.includes('group') ? 1 : 0);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function groupPreview() {
    if (format !== 'group' || !numberOfGroups) return null;
    const ng = Number(numberOfGroups);
    if (players.length % ng !== 0) return null;
    const perGroup = players.length / ng;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return Array.from({ length: ng }, (_, g) => ({
      name: `Group ${letters[g]}`,
      players: players.slice(g * perGroup, (g + 1) * perGroup),
    }));
  }

  const groups = groupPreview();
  const matchesPerGroup = format === 'group' && groups
    ? (groups[0].players.length * (groups[0].players.length - 1)) / 2
    : 0;
  const totalMatchesRR = (players.length * (players.length - 1)) / 2;
  const validGroupCounts = findValidGroupCounts(players.length);

  return (
    <div className="app-shell">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4">
        <div className="max-w-2xl mx-auto py-10">
          {/* Step indicator */}
          <div className="flex items-center justify-center mb-8 gap-0">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center">
                <div className={`theme-step-chip ${i === step ? 'active' : i < step ? 'done' : 'idle'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`mx-2 text-sm font-medium ${i === step ? 'text-[#314b24]' : 'text-[#8a8178]'}`}>{label}</span>
                {i < STEPS.length - 1 && <div className={`theme-step-bar ${i < step ? 'done' : 'idle'}`} />}
              </div>
            ))}
          </div>

          <div className="theme-card rounded-[1.75rem] p-8">
            {/* Step 0: Players */}
            {step === 0 && (
              <div className="space-y-5">
                <h2 className="text-2xl font-bold theme-page-title flex items-center gap-2">
                  <Users className="w-6 h-6 text-[#4F772D]" />Players &amp; Tournament Name
                </h2>
                <div>
                  <label className={fieldLabelClassName}>Tournament Name</label>
                  <input
                    value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. Champions League 2026"
                    className="theme-input"
                  />
                </div>
                <div>
                  <label className={fieldLabelClassName}>
                    Players / Teams <span className="text-[#8a8178] font-normal">(one per line)</span>
                  </label>
                  <textarea
                    value={playersText} onChange={e => setPlayersText(e.target.value)}
                    rows={10} placeholder={"Brazil\nArgentina\nFrance\nEngland\n..."}
                    className="theme-textarea font-mono text-sm"
                  />
                  <p className="text-xs theme-page-subtle mt-1">
                    {players.length} player{players.length !== 1 ? 's' : ''} entered
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox" id="randomOrder" checked={randomOrder}
                    onChange={e => setRandomOrder(e.target.checked)} className="w-4 h-4"
                  />
                  <label htmlFor="randomOrder" className="text-sm flex items-center gap-1 cursor-pointer text-[#5f554d]">
                    <Shuffle className="w-4 h-4" />Randomize player order (draw)
                  </label>
                </div>
              </div>
            )}

            {/* Step 1: Format */}
            {step === 1 && (
              <div className="space-y-5">
                <h2 className="text-2xl font-bold theme-page-title">Choose Tournament Format</h2>
                <p className="theme-page-subtle text-sm">You have <strong>{players.length}</strong> players/teams.</p>
                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => setFormat('round-robin')}
                    className={`theme-option-card rounded-2xl p-5 text-left transition-all ${format === 'round-robin' ? 'active' : ''}`}
                  >
                    <div className="font-bold text-lg mb-1 theme-page-title">🔄 Round Robin</div>
                    <p className="text-sm theme-page-subtle">Every player plays against every other. Top 50% advance to knockout.</p>
                    <p className="text-xs text-[#4F772D] mt-2 font-medium">
                      {players.length} players → {totalMatchesRR} total matches → top {Math.floor(players.length / 2)} advance
                    </p>
                  </button>
                  <button
                    onClick={() => setFormat('group')}
                    className={`theme-option-card rounded-2xl p-5 text-left transition-all ${format === 'group' ? 'active' : ''}`}
                  >
                    <div className="font-bold text-lg mb-1 theme-page-title">🏆 Group Stage</div>
                    <p className="text-sm theme-page-subtle">Players split into equal groups. Each plays round-robin. Top 2 from each group advance.</p>
                    <p className="text-xs theme-page-subtle mt-1">Groups must have equal number of players.</p>
                  </button>
                </div>

                {format === 'group' && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className={fieldLabelClassName}>Number of Groups</label>
                      <div className="flex flex-wrap gap-2">
                        {validGroupCounts.map(n => (
                          <button
                            key={n} onClick={() => setNumberOfGroups(n)}
                            className={`px-4 py-2 rounded-lg border font-medium text-sm transition-colors ${
                              Number(numberOfGroups) === n ? 'bg-[#4F772D] text-white border-[#4F772D]' : 'border-[#c6d3b1] text-[#314b24] bg-white hover:border-[#90A955]'
                            }`}
                          >
                            {n} groups ({players.length / n} players each)
                          </button>
                        ))}
                        {validGroupCounts.length === 0 && (
                          <p className="text-red-500 text-sm">
                            No valid group configuration for {players.length} players. Adjust player count.
                          </p>
                        )}
                      </div>
                    </div>
                    {groups && (
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        {groups.map(g => (
                          <div key={g.name} className="theme-card-muted rounded-xl p-3">
                            <div className="font-semibold text-sm mb-1 text-[#35531f]">{g.name}</div>
                            {g.players.map(p => <div key={p} className="text-sm text-gray-700 py-0.5">{p}</div>)}
                            <div className="text-xs theme-page-subtle mt-1">{matchesPerGroup} matches</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Review */}
            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-2xl font-bold theme-page-title">Review &amp; Create</h2>
                <div className="theme-panel-soft rounded-xl p-4 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="theme-page-subtle">Tournament</span><span className="font-semibold">{name}</span></div>
                  <div className="flex justify-between"><span className="theme-page-subtle">Players</span><span className="font-semibold">{players.length}</span></div>
                  <div className="flex justify-between"><span className="theme-page-subtle">Format</span><span className="font-semibold capitalize">{format === 'round-robin' ? 'Round Robin' : `Group Stage (${numberOfGroups} groups)`}</span></div>
                  <div className="flex justify-between"><span className="theme-page-subtle">Draw Order</span><span className="font-semibold">{randomOrder ? 'Random' : 'As entered'}</span></div>
                  {format === 'group' && <div className="flex justify-between"><span className="theme-page-subtle">Players per group</span><span className="font-semibold">{players.length / Number(numberOfGroups)}</span></div>}
                  {format === 'group' && <div className="flex justify-between"><span className="theme-page-subtle">Advancing per group</span><span className="font-semibold">2</span></div>}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#5f554d] mb-2">Players ({players.length}):</p>
                  <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-1">
                    {players.map((p, i) => (
                      <div key={i} className="text-sm bg-white border border-[#d9e2cb] rounded px-2 py-1">{i + 1}. {p}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="theme-danger-panel mt-4 text-red-700 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-between mt-8">
              {step > 0 ? (
                <button
                  onClick={() => { setError(''); setStep(s => s - 1); }}
                  className="theme-secondary-btn"
                >
                  <ChevronLeft className="w-4 h-4" />Back
                </button>
              ) : <div />}
              {step < 2 ? (
                <button
                  onClick={nextStep}
                  className="theme-primary-btn"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={submit} disabled={loading}
                  className="theme-primary-btn px-6"
                >
                  {loading ? 'Creating...' : <><Trophy className="w-4 h-4" />Create Tournament</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
