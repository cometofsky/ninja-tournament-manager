'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Trophy, Users, Plus } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { getStoredAdminToken } from '@/lib/clientAuth';

const FORMAT_LABEL = { 'round-robin': 'Round Robin', 'group': 'Group Stage' };
const STATUS_COLORS = {
  'in-progress': 'theme-status-pill progress',
  'completed': 'theme-status-pill complete',
  'setup': 'theme-status-pill setup',
};

export default function HomePage() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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

  return (
    <div className="app-shell">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold theme-page-title flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#4F772D]" />
            Tournaments
          </h2>
          {isAdmin && (
            <Link
              href="/create"
              className="theme-primary-btn text-sm"
            >
              <Plus className="w-4 h-4" /> New Tournament
            </Link>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center theme-page-subtle">Loading tournaments...</div>
        ) : tournaments.length === 0 ? (
          <div className="theme-panel-soft rounded-[1.75rem] px-6 py-16 text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-[#90A955] opacity-80" />
            <p className="text-lg font-medium theme-page-title">No tournaments yet.</p>
            {isAdmin && (
              <Link href="/create" className="theme-link mt-3 inline-block text-sm">
                Create the first tournament →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tournaments.map(t => {
              const currentStage = t.stages?.[t.currentStageIndex];
              return (
                <Link
                  key={t._id}
                  href={`/tournaments/${t._id}`}
                  className="theme-card rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-[#90A955] hover:shadow-[0_24px_50px_rgba(19,42,19,0.12)]"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold theme-page-title leading-tight">{t.name}</h3>
                    <span className={`ml-2 shrink-0 ${STATUS_COLORS[t.status] || 'theme-status-pill setup'}`}>
                      {t.status === 'in-progress' ? 'In Progress' : t.status === 'completed' ? 'Completed' : t.status}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm theme-page-subtle">
                    <p className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[#7D6D61]" />
                      {t.players?.length || 0} Players
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-[#7D6D61]" />
                      {FORMAT_LABEL[t.initialFormat] || t.initialFormat}
                    </p>
                    {currentStage && t.status !== 'completed' && (
                      <p className="text-xs font-medium text-[#4F772D]">
                        Current: {currentStage.label}
                      </p>
                    )}
                    {t.status === 'completed' && t.champion && (
                      <p className="text-xs text-yellow-700 font-semibold flex items-center gap-1">
                        🏆 {t.champion}
                      </p>
                    )}
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
