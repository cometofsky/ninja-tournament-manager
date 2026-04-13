'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
      <main className="max-w-7xl mx-auto px-4">
        <div className="max-w-md mx-auto py-12">
          <h1 className="text-3xl font-bold mb-6 text-center theme-page-title">Admin Login</h1>
          <form onSubmit={submit} className="theme-card space-y-4 p-6 rounded-[1.5rem]">
            <div>
              <label className="block text-sm font-medium mb-1 text-[#314b24]">Email</label>
              <input
                value={email} onChange={e => setEmail(e.target.value)}
                type="email" required
                className="theme-input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-[#314b24]">Password</label>
                <Link href="/forgot-password" className="theme-link text-xs">
                  Forgot password?
                </Link>
              </div>
              <input
                value={password} onChange={e => setPassword(e.target.value)}
                type="password" required
                className="theme-input"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              disabled={loading}
              className="theme-primary-btn w-full"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <p className="text-sm text-center theme-page-subtle">
              No account?{' '}
              <Link href="/register" className="theme-link">Register</Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
