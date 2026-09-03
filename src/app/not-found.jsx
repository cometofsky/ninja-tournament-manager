import Link from 'next/link';
import { Trophy, Home, ArrowLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function NotFound() {
  return (
    <div className="app-shell">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-7xl mx-auto px-4 flex items-center justify-center py-20">
        <div className="max-w-md w-full text-center">
          <div className="relative inline-block mb-6">
            <div className="w-24 h-24 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
              <Trophy className="w-12 h-12 text-emerald-600 opacity-40" />
            </div>
            <span className="absolute -bottom-2 -right-2 px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-full shadow">
              404
            </span>
          </div>

          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Match Not Found
          </h1>
          <p className="text-slate-600 text-base mb-8">
            The tournament, stage, or match you are looking for has concluded or does not exist.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto theme-primary-btn px-5 py-2.5 shadow-sm"
            >
              <Home className="w-4 h-4" /> Return to Dashboard
            </Link>
            <Link
              href="/create"
              className="w-full sm:w-auto theme-secondary-btn px-5 py-2.5 shadow-sm"
            >
              Create Tournament
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
