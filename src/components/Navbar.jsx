'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Trophy, LogOut, Lock, Plus } from 'lucide-react';
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
    <header className="sticky top-0 z-50 border-b border-[#dfe6d2] bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/88">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <Trophy className="w-7 h-7 text-[#4F772D]" />
          <span className="text-xl font-bold bg-gradient-to-r from-[#132A13] to-[#4F772D] bg-clip-text text-transparent">
            Tournament Manager
          </span>
        </Link>
        <div className="flex gap-2 items-center">
          {isAdmin ? (
            <>
              <Link
                href="/create"
                className={`px-4 py-2 rounded-xl flex items-center gap-1.5 text-sm font-medium transition-colors ${pathname === '/create' ? 'bg-[#132A13] text-white' : 'bg-[#4F772D] text-white hover:bg-[#3e5e23]'}`}
              >
                <Plus className="w-4 h-4" /> Create
              </Link>
              <button
                onClick={logout}
                className="bg-[#ece8e0] px-4 py-2 rounded-xl flex items-center gap-1.5 text-sm font-medium text-[#5f554d] hover:bg-[#e2dbd1]"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={`px-4 py-2 rounded-xl flex items-center gap-1.5 text-sm font-medium transition-colors ${pathname === '/login' ? 'bg-[#132A13] text-white' : 'bg-[#4F772D] text-white hover:bg-[#3e5e23]'}`}
              >
                <Lock className="w-4 h-4" /> Login
              </Link>
              {/*<Link
                href="/register"
                className="bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Register
              </Link>*/}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
