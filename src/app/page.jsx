'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Calendar, Trophy, Users, Plus, Search, CheckCircle2, Clock, Swords, ChevronRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { getStoredAdminToken } from '@/lib/clientAuth';

const FORMAT_LABEL = { 'round-robin': 'Round Robin', 'group': 'Group Stage' };

export default function HomePage() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const refreshAuth = () => setIsAdmin(!!getStoredAdminToken());
    refreshAuth();
    window.addEventListener('storage', refreshAuth);
    window.addEventListener('auth-change', refreshAuth);
    fetchTournaments();
    return () => {
      window.removeEventListener('storage', refreshAuth);
      window.removeEventListener('auth-change', refreshAuth);
    };
  }, []);

  async function fetchTournaments() {
    try {
      const res = await fetch('/api/tournaments');
      const data = await res.json();
      setTournaments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const total = tournaments.length;
    const inProgress = tournaments.filter(t => t.status === 'in-progress').length;
    const completed = tournaments.filter(t => t.status === 'completed').length;
    const totalPlayers = tournaments.reduce((acc, t) => acc + (t.players?.length || 0), 0);
    return { total, inProgress, completed, totalPlayers };
  }, [tournaments]);

  const filteredTournaments = useMemo(() => {
    return tournaments.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesStatus =
        statusFilter === 'all' ? true : t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tournaments, searchQuery, statusFilter]);

  return (
    <div className="app-shell">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-2">
              <Swords className="w-3.5 h-3.5 text-emerald-600" />
              Tournament Control Center
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Tournaments
            </h1>
            <p className="text-slate-500 text-base mt-1 max-w-2xl">
              Live brackets, round-robin standings, match scoring, and championship tracking.
            </p>
          </div>
          {isAdmin && (
            <Link
              href="/create"
              className="theme-primary-btn shadow-md self-start md:self-auto"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" /> Create Tournament
            </Link>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</span>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">
              {loading ? '—' : stats.total}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Competitions created</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">In Progress</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-900 mt-2 tabular-nums">
              {loading ? '—' : stats.inProgress}
            </p>
            <p className="text-xs text-amber-600/80 mt-0.5">Active stages live</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-900 mt-2 tabular-nums">
              {loading ? '—' : stats.completed}
            </p>
            <p className="text-xs text-emerald-600/80 mt-0.5">Champions crowned</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Players</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">
              {loading ? '—' : stats.totalPlayers}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Total roster entries</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 mb-6 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tournaments by name..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'All', count: tournaments.length },
              { id: 'in-progress', label: 'Active', count: stats.inProgress },
              { id: 'completed', label: 'Completed', count: stats.completed },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                    statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm animate-pulse-subtle"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="h-5 bg-slate-200 rounded-md w-3/5" />
                  <div className="h-5 bg-slate-100 rounded-full w-20" />
                </div>
                <div className="space-y-2 mb-6">
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                  <div className="h-4 bg-slate-100 rounded w-1/2" />
                </div>
                <div className="h-9 bg-slate-50 rounded-xl w-full" />
              </div>
            ))}
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-sm max-w-xl mx-auto my-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 opacity-60" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              {searchQuery || statusFilter !== 'all' ? 'No matches found' : 'No tournaments created yet'}
            </h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search query or status filter to find what you are looking for.'
                : 'Get started by creating your first round-robin or group tournament with automated schedule generation.'}
            </p>
            {searchQuery || statusFilter !== 'all' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="theme-secondary-btn mt-5 text-sm"
              >
                Reset Filters
              </button>
            ) : isAdmin ? (
              <Link href="/create" className="theme-primary-btn mt-5 inline-flex text-sm shadow-md">
                <Plus className="w-4 h-4 stroke-[2.5]" /> Create First Tournament
              </Link>
            ) : (
              <Link href="/login" className="theme-secondary-btn mt-5 inline-flex text-sm">
                Login as Admin to Create
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTournaments.map(t => {
              const currentStage = t.stages?.[t.currentStageIndex];
              const isCompleted = t.status === 'completed';
              const isInProgress = t.status === 'in-progress';

              return (
                <Link
                  key={t._id}
                  href={`/tournaments/${t._id}`}
                  className="group bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/70">
                        {FORMAT_LABEL[t.initialFormat] || t.initialFormat}
                      </span>
                      {isInProgress && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          In Progress
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Completed
                        </span>
                      )}
                      {t.status === 'setup' && (
                        <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          Setup
                        </span>
                      )}
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug">
                      {t.name}
                    </h2>

                    <div className="mt-3.5 space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="tabular-nums font-medium text-slate-700">{t.players?.length || 0}</span> Competitors
                      </div>

                      {currentStage && !isCompleted && (
                        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50/80 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                          <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Stage: <strong>{currentStage.label}</strong></span>
                        </div>
                      )}

                      {isCompleted && t.champion && (
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-50/90 px-2.5 py-1.5 rounded-lg border border-amber-200/80">
                          <Trophy className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Champion: <strong className="text-amber-900 font-extrabold">{t.champion}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700 group-hover:text-emerald-800">
                    <span>{isCompleted ? 'View Full Results' : 'Open Match Center'}</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

