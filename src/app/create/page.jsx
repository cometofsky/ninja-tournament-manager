'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, Trophy, ChevronRight, ChevronLeft, Shuffle, Check, AlertCircle, Sparkles, Layers, ShieldAlert } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { clearAdminToken, getStoredAdminToken } from '@/lib/clientAuth';

const STEPS = [
  { label: 'Roster & Setup', desc: 'Tournament name & players' },
  { label: 'Format & Groups', desc: 'Competition structure' },
  { label: 'Review & Launch', desc: 'Final confirmation' },
];

const SAMPLE_TEAMS = ['Arsenal', 'Barcelona', 'Bayern Munich', 'Chelsea', 'Juventus', 'Liverpool', 'Real Madrid', 'Paris SG'];

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
    return null; // Hydrating
  }

  if (!token) {
    return (
      <div className="app-shell">
        <Navbar />
        <main id="main-content" className="flex-1 max-w-7xl mx-auto px-4 flex items-center justify-center py-20">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-10 max-w-md w-full text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Privileges Required</h1>
            <p className="text-slate-500 text-sm mt-2 mb-6">
              You must be authenticated as an administrator to create tournaments and configure stages.
            </p>
            <Link href="/login" className="theme-primary-btn w-full shadow-sm">
              Login to Admin Portal
            </Link>
          </div>
        </main>
      </div>
    );
  }

  function fillSampleRoster() {
    setName('Champions Invitational 2026');
    setPlayersText(SAMPLE_TEAMS.join('\n'));
    setError('');
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
    if (players.length < 2) return 'Enter at least 2 competitors (one per line).';
    const dupes = new Set();
    for (const p of players) {
      if (dupes.has(p)) return `Duplicate competitor name: "${p}". All names must be unique.`;
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
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="max-w-3xl mx-auto">
          {/* Stepper Header */}
          <div className="mb-10">
            <div className="flex items-center justify-between relative">
              {/* Connector line */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-full bg-slate-200 -z-0" />
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-600 transition-all duration-300 -z-0"
                style={{ width: step === 0 ? '0%' : step === 1 ? '50%' : '100%' }}
              />

              {STEPS.map((s, i) => (
                <div key={i} className="flex flex-col items-center relative z-10 bg-[#f8fafc] px-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200 ${
                      i === step
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-4 ring-emerald-100'
                        : i < step
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white text-slate-400 border-2 border-slate-200'
                    }`}
                  >
                    {i < step ? <Check className="w-5 h-5 stroke-[2.5]" /> : i + 1}
                  </div>
                  <span className={`text-xs font-bold mt-2 ${i === step ? 'text-slate-900' : 'text-slate-500'}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Form Container Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-sm">
            {/* Step 0: Players & Tournament Name */}
            {step === 0 && (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                      <Users className="w-6 h-6 text-emerald-600" /> Competitors &amp; Details
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                      Provide a title and roster of participating players or teams.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fillSampleRoster}
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 transition-colors"
                    title="Fill 8 sample teams for quick testing"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Sample Roster
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Tournament Name
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Champions League 2026, Summer Cup"
                    className="theme-input"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">A clear, descriptive name for the championship.</p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-semibold text-slate-800">
                      Competitors / Teams <span className="text-slate-400 font-normal">(one per line)</span>
                    </label>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      players.length >= 2 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {players.length} competitor{players.length !== 1 ? 's' : ''} entered
                    </span>
                  </div>
                  <textarea
                    value={playersText}
                    onChange={e => setPlayersText(e.target.value)}
                    rows={8}
                    placeholder={"Arsenal\nBarcelona\nBayern Munich\nChelsea\n..."}
                    className="theme-textarea font-mono text-sm leading-relaxed"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Enter at least 2 competitors. For group stages, enter an even number divisible by the group count.
                  </p>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      id="randomOrder"
                      checked={randomOrder}
                      onChange={e => setRandomOrder(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        <Shuffle className="w-4 h-4 text-emerald-600" /> Randomize Roster Draw Order
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Shuffles the seeding before generating Berger rotation fixtures or group distributions.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Step 1: Format */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-5">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                    <Layers className="w-6 h-6 text-emerald-600" /> Select Tournament Structure
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Configuring format for <strong className="text-slate-800">{players.length} competitors</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Round Robin Card */}
                  <button
                    type="button"
                    onClick={() => setFormat('round-robin')}
                    className={`text-left p-6 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between ${
                      format === 'round-robin'
                        ? 'border-emerald-600 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-2xl">🔄</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          format === 'round-robin' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                        }`}>
                          {format === 'round-robin' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                      <h3 className="font-bold text-lg text-slate-900">Single Round Robin</h3>
                      <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                        Every competitor plays against every other. Top 50% advance to a single-elimination knockout stage.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/60 text-xs font-semibold text-emerald-800">
                      {totalMatchesRR} matches · Top {Math.floor(players.length / 2)} advance
                    </div>
                  </button>

                  {/* Group Stage Card */}
                  <button
                    type="button"
                    onClick={() => setFormat('group')}
                    className={`text-left p-6 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between ${
                      format === 'group'
                        ? 'border-emerald-600 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-2xl">🏆</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          format === 'group' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                        }`}>
                          {format === 'group' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                      <h3 className="font-bold text-lg text-slate-900">Group Stage + Knockout</h3>
                      <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                        Players split into equal groups. Each group plays round-robin fixtures; top 2 from each group qualify for knockout.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/60 text-xs font-semibold text-emerald-800">
                      {numberOfGroups} groups · Top 2 per group qualify
                    </div>
                  </button>
                </div>

                {format === 'group' && (
                  <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        Select Group Division
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {validGroupCounts.map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setNumberOfGroups(n)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                              Number(numberOfGroups) === n
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400'
                            }`}
                          >
                            {n} Groups ({players.length / n} players each)
                          </button>
                        ))}
                        {validGroupCounts.length === 0 && (
                          <p className="text-red-600 text-xs font-semibold">
                            {players.length} players cannot be equally divided into at least 2 groups with ≥2 players each.
                          </p>
                        )}
                      </div>
                    </div>

                    {groups && (
                      <div className="pt-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Group Distribution Preview</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {groups.map(g => (
                            <div key={g.name} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-sm text-slate-900">{g.name}</span>
                                <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                                  {matchesPerGroup} matches
                                </span>
                              </div>
                              <div className="space-y-1">
                                {g.players.map((p, idx) => (
                                  <div key={idx} className="text-xs text-slate-600 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>{p}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Review */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-5">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                    <Trophy className="w-6 h-6 text-emerald-600" /> Review &amp; Launch
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Confirm your configuration before generating fixtures.
                  </p>
                </div>

                <div className="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-5 divide-y divide-slate-200/60 text-sm">
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-500">Tournament Title</span>
                    <span className="font-bold text-slate-900">{name}</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-500">Competitor Count</span>
                    <span className="font-bold text-slate-900 tabular-nums">{players.length} Players</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-500">Format</span>
                    <span className="font-bold text-emerald-700 capitalize">
                      {format === 'round-robin' ? 'Round Robin (Berger Rotation)' : `Group Stage (${numberOfGroups} groups)`}
                    </span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-500">Seeding Order</span>
                    <span className="font-bold text-slate-900">{randomOrder ? 'Randomized Draw' : 'Fixed Entry Order'}</span>
                  </div>
                  {format === 'group' && (
                    <>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-500">Roster Per Group</span>
                        <span className="font-bold text-slate-900 tabular-nums">{players.length / Number(numberOfGroups)}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-500">Advancement Rule</span>
                        <span className="font-bold text-emerald-700">Top 2 per group advance to Knockout</span>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Registered Competitors ({players.length}):
                  </h4>
                  <div className="max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1">
                    {players.map((p, i) => (
                      <div
                        key={i}
                        className="text-xs bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5"
                      >
                        <span className="text-[10px] font-bold text-slate-400 tabular-nums w-4">{i + 1}.</span>
                        <span className="font-medium text-slate-700 truncate">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Inline Error Notice */}
            {error && (
              <div className="mt-6 flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Stepper Navigation Buttons */}
            <div className="flex items-center justify-between pt-8 mt-8 border-t border-slate-100">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => { setError(''); setStep(s => s - 1); }}
                  className="theme-secondary-btn"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              ) : (
                <div />
              )}

              {step < 2 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="theme-primary-btn"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading}
                  className="theme-primary-btn px-6 shadow-md"
                >
                  {loading ? 'Creating Tournament...' : <><Trophy className="w-4 h-4" /> Launch Tournament</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
