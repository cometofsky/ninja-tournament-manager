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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4">
        <div className="max-w-md mx-auto py-12">
          <h1 className="text-3xl font-bold mb-6 text-center">Create Admin Account</h1>
          <form onSubmit={submit} className="space-y-4 bg-white p-6 rounded-xl shadow">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                value={email} onChange={e => setEmail(e.target.value)}
                type="email" required
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Password <span className="text-gray-400 font-normal text-xs">(min. 8 characters)</span>
              </label>
              <input
                value={password} onChange={e => setPassword(e.target.value)}
                type="password" required
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm Password</label>
              <input
                value={confirm} onChange={e => setConfirm(e.target.value)}
                type="password" required
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60 font-medium"
            >
              {loading ? 'Creating account...' : 'Register'}
            </button>
            <p className="text-sm text-center">
              Already have an account?{' '}
              <Link href="/login" className="text-indigo-600 hover:underline">Login</Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
