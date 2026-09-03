'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trophy, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('adminToken', data.token);
        window.dispatchEvent(new Event('auth-change'));
        router.push('/');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 flex items-center justify-center py-16">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin Portal</h1>
            <p className="text-slate-500 text-sm mt-1">
              Sign in to manage tournament fixtures, scores, and stages.
            </p>
          </div>

          <form onSubmit={submit} className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">Email Address</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                required
                className="theme-input"
                placeholder="admin@tournament.org"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-semibold text-slate-800">Password</label>
                <Link href="/forgot-password" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                  Forgot password?
                </Link>
              </div>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                required
                placeholder="••••••••"
                className="theme-input"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="theme-primary-btn w-full shadow-md py-3 text-sm"
            >
              {loading ? 'Authenticating...' : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Need an administrator account?{' '}
                <Link href="/register" className="font-semibold text-emerald-700 hover:text-emerald-800">
                  Register admin
                </Link>
              </p>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

