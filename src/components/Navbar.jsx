'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Trophy, LogOut, Lock, Plus, ShieldCheck } from 'lucide-react';
import { clearAdminToken, getStoredAdminToken } from '@/lib/clientAuth';

export default function Navbar() {
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const refreshAuth = () => setIsAdmin(!!getStoredAdminToken());

  useEffect(() => {
    refreshAuth();
    window.addEventListener('storage', refreshAuth);
    window.addEventListener('auth-change', refreshAuth);
    return () => {
      window.removeEventListener('storage', refreshAuth);
      window.removeEventListener('auth-change', refreshAuth);
    };
  }, []);

  const logout = () => {
    clearAdminToken();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center gap-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
            aria-label="Tournament Manager Home"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-sm shadow-emerald-600/30 group-hover:scale-105 transition-transform duration-200">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-slate-900 tracking-tight leading-none group-hover:text-emerald-700 transition-colors">
                Tournament Manager
              </span>
              <span className="text-[10px] font-medium text-slate-500 tracking-wider uppercase mt-0.5">
                Championship Engine
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/'
                  ? 'text-emerald-700 bg-emerald-50/80 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              Dashboard
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          {isAdmin ? (
            <>
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Admin
              </div>
              <Link
                href="/create"
                className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 text-sm font-semibold transition-all ${
                  pathname === '/create'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 active:scale-[0.98]'
                }`}
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">New Tournament</span>
                <span className="sm:hidden">Create</span>
              </Link>
              <button
                onClick={logout}
                className="px-3 py-2 rounded-xl flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all active:scale-[0.98]"
                title="Log out of admin session"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className={`px-4 py-2 rounded-xl flex items-center gap-1.5 text-sm font-semibold transition-all ${
                pathname === '/login'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm active:scale-[0.98]'
              }`}
            >
              <Lock className="w-4 h-4 text-slate-500" /> Admin Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
