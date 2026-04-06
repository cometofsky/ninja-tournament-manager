'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Trophy, LogOut, Lock, Plus } from 'lucide-react';

export default function Navbar() {
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  const refreshAuth = () => setIsAdmin(!!localStorage.getItem('adminToken'));

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
    localStorage.removeItem('adminToken');
    window.dispatchEvent(new Event('auth-change'));
    router.push('/');
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <Trophy className="w-7 h-7 text-indigo-600" />
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Tournament Manager
          </span>
        </Link>
        <div className="flex gap-2 items-center">
          {isAdmin ? (
            <>
              <Link
                href="/create"
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 text-sm font-medium hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4" /> Create
              </Link>
              <button
                onClick={logout}
                className="bg-gray-100 px-4 py-2 rounded-lg flex items-center gap-1.5 text-sm font-medium hover:bg-gray-200"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 text-sm font-medium hover:bg-indigo-700"
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
