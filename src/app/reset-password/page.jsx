'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import Navbar from '@/components/Navbar';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!token) setError('Invalid or missing reset token. Please request a new reset link.');
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError(data.error || 'Reset failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8">
          <Lock className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-green-800 mb-2">Password Reset!</h2>
          <p className="text-green-700 text-sm">Your password has been reset. Redirecting to login...</p>
          <Link href="/login" className="mt-4 inline-block text-indigo-600 text-sm hover:underline">
            Go to Login now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <h1 className="text-3xl font-bold mb-2 text-center">Reset Password</h1>
      <p className="text-gray-500 text-sm text-center mb-6">Enter your new password below.</p>
      <form onSubmit={submit} className="space-y-4 bg-white p-6 rounded-xl shadow">
        <div>
          <label className="block text-sm font-medium mb-1">New Password</label>
          <input
            type="password" required value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirm Password</label>
          <input
            type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Re-enter password"
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!token ? (
          <p className="text-sm text-center">
            <Link href="/forgot-password" className="text-indigo-600 hover:underline">
              Request a new reset link
            </Link>
          </p>
        ) : (
          <button
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60 font-medium"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        )}
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4">
        {/* useSearchParams requires Suspense boundary in Next.js App Router */}
        <Suspense fallback={<div className="py-12 text-center text-gray-400">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </main>
    </div>
  );
}
