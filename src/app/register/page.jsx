'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push('/login');
      } else {
        setError(data.error || 'Registration failed');
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
          <h1 className="text-3xl font-bold mb-6 text-center theme-page-title">Create Admin Account</h1>
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
              <label className="block text-sm font-medium mb-1 text-[#314b24]">
                Password <span className="text-[#8a8178] font-normal text-xs">(min. 8 characters)</span>
              </label>
              <input
                value={password} onChange={e => setPassword(e.target.value)}
                type="password" required
                className="theme-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#314b24]">Confirm Password</label>
              <input
                value={confirm} onChange={e => setConfirm(e.target.value)}
                type="password" required
                className="theme-input"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              disabled={loading}
              className="theme-primary-btn w-full"
            >
              {loading ? 'Creating account...' : 'Register'}
            </button>
            <p className="text-sm text-center theme-page-subtle">
              Already have an account?{' '}
              <Link href="/login" className="theme-link">Login</Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
