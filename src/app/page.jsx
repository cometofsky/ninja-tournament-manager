'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Trophy, Users, Plus } from 'lucide-react';
import Navbar from '@/components/Navbar';

const FORMAT_LABEL = { 'round-robin': 'Round Robin', 'group': 'Group Stage' };
const STATUS_COLORS = {
  'in-progress': 'bg-blue-100 text-blue-700',
  'completed': 'bg-green-100 text-green-700',
  'setup': 'bg-gray-100 text-gray-600',
};

export default function HomePage() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(!!localStorage.getItem('adminToken'));
    fetchTournaments();
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            Tournaments
          </h2>
          {isAdmin && (
            <Link
              href="/create"
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" /> New Tournament
            </Link>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading tournaments...</div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No tournaments yet.</p>
            {isAdmin && (
              <Link href="/create" className="mt-3 inline-block text-indigo-600 hover:underline text-sm">
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
                  className="bg-white rounded-xl shadow hover:shadow-lg transition-all border border-transparent hover:border-indigo-200 p-5"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-gray-900 leading-tight">{t.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0 ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-600'}`}>
                      {t.status === 'in-progress' ? 'In Progress' : t.status === 'completed' ? 'Completed' : t.status}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm text-gray-600">
                    <p className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-gray-400" />
                      {t.players?.length || 0} Players
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-gray-400" />
                      {FORMAT_LABEL[t.initialFormat] || t.initialFormat}
                    </p>
                    {currentStage && t.status !== 'completed' && (
                      <p className="text-xs text-indigo-600 font-medium">
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
