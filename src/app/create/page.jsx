'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Trophy, ChevronRight, ChevronLeft, Shuffle } from 'lucide-react';
import Navbar from '@/components/Navbar';

const STEPS = ['Players', 'Format', 'Review'];

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
    const t = localStorage.getItem('adminToken');
    setToken(t);
  }, []);

  const players = playersText.split('\n').map(p => p.trim()).filter(Boolean);

  if (token === null) {
    // Still hydrating — avoid flash
    return null;
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4">
          <div className="py-16 text-center text-gray-500">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-40" />
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4">
        <div className="max-w-2xl mx-auto py-10">
          {/* Step indicator */}
          <div className="flex items-center justify-center mb-8 gap-0">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                  i === step ? 'bg-indigo-600 text-white' : i < step ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`mx-2 text-sm font-medium ${i === step ? 'text-indigo-700' : 'text-gray-400'}`}>{label}</span>
                {i < STEPS.length - 1 && <div className={`w-8 h-1 rounded ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-md p-8">
            {/* Step 0: Players */}
            {step === 0 && (
              <div className="space-y-5">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Users className="w-6 h-6 text-indigo-600" />Players &amp; Tournament Name
                </h2>
                <div>
                  <label className="block text-sm font-semibold mb-1">Tournament Name</label>
                  <input
                    value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. Champions League 2026"
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Players / Teams <span className="text-gray-400 font-normal">(one per line)</span>
                  </label>
                  <textarea
                    value={playersText} onChange={e => setPlayersText(e.target.value)}
                    rows={10} placeholder={"Brazil\nArgentina\nFrance\nEngland\n..."}
                    className="w-full border rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {players.length} player{players.length !== 1 ? 's' : ''} entered
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox" id="randomOrder" checked={randomOrder}
                    onChange={e => setRandomOrder(e.target.checked)} className="w-4 h-4"
                  />
                  <label htmlFor="randomOrder" className="text-sm flex items-center gap-1 cursor-pointer">
                    <Shuffle className="w-4 h-4" />Randomize player order (draw)
                  </label>
                </div>
              </div>
            )}

            {/* Step 1: Format */}
            {step === 1 && (
              <div className="space-y-5">
                <h2 className="text-2xl font-bold">Choose Tournament Format</h2>
                <p className="text-gray-500 text-sm">You have <strong>{players.length}</strong> players/teams.</p>
                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => setFormat('round-robin')}
                    className={`p-5 rounded-xl border-2 text-left transition-all ${format === 'round-robin' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
                  >
                    <div className="font-bold text-lg mb-1">🔄 Round Robin</div>
                    <p className="text-sm text-gray-600">Every player plays against every other. Top 50% advance to knockout.</p>
                    <p className="text-xs text-indigo-600 mt-2 font-medium">
                      {players.length} players → {totalMatchesRR} total matches → top {Math.floor(players.length / 2)} advance
                    </p>
                  </button>
                  <button
                    onClick={() => setFormat('group')}
                    className={`p-5 rounded-xl border-2 text-left transition-all ${format === 'group' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
                  >
                    <div className="font-bold text-lg mb-1">🏆 Group Stage</div>
                    <p className="text-sm text-gray-600">Players split into equal groups. Each plays round-robin. Top 2 from each group advance.</p>
                    <p className="text-xs text-gray-500 mt-1">Groups must have equal number of players.</p>
                  </button>
                </div>

                {format === 'group' && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Number of Groups</label>
                      <div className="flex flex-wrap gap-2">
                        {validGroupCounts.map(n => (
                          <button
                            key={n} onClick={() => setNumberOfGroups(n)}
                            className={`px-4 py-2 rounded-lg border font-medium text-sm transition-colors ${
                              Number(numberOfGroups) === n ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 hover:border-indigo-400'
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
                          <div key={g.name} className="bg-gray-50 rounded-lg p-3 border">
                            <div className="font-semibold text-sm mb-1 text-indigo-700">{g.name}</div>
                            {g.players.map(p => <div key={p} className="text-sm text-gray-700 py-0.5">{p}</div>)}
                            <div className="text-xs text-gray-400 mt-1">{matchesPerGroup} matches</div>
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
                <h2 className="text-2xl font-bold">Review &amp; Create</h2>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Tournament</span><span className="font-semibold">{name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Players</span><span className="font-semibold">{players.length}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Format</span><span className="font-semibold capitalize">{format === 'round-robin' ? 'Round Robin' : `Group Stage (${numberOfGroups} groups)`}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Draw Order</span><span className="font-semibold">{randomOrder ? 'Random' : 'As entered'}</span></div>
                  {format === 'group' && <div className="flex justify-between"><span className="text-gray-500">Players per group</span><span className="font-semibold">{players.length / Number(numberOfGroups)}</span></div>}
                  {format === 'group' && <div className="flex justify-between"><span className="text-gray-500">Advancing per group</span><span className="font-semibold">2</span></div>}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">Players ({players.length}):</p>
                  <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-1">
                    {players.map((p, i) => (
                      <div key={i} className="text-sm bg-white border rounded px-2 py-1">{i + 1}. {p}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-between mt-8">
              {step > 0 ? (
                <button
                  onClick={() => { setError(''); setStep(s => s - 1); }}
                  className="flex items-center gap-1 text-gray-600 border rounded-lg px-4 py-2 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />Back
                </button>
              ) : <div />}
              {step < 2 ? (
                <button
                  onClick={nextStep}
                  className="flex items-center gap-1 bg-indigo-600 text-white rounded-lg px-5 py-2 hover:bg-indigo-700 font-medium"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={submit} disabled={loading}
                  className="flex items-center gap-2 bg-green-600 text-white rounded-lg px-6 py-2 hover:bg-green-700 font-medium disabled:opacity-60"
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
