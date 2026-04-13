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
        <div className="theme-success-panel rounded-[1.5rem] p-8">
          <Lock className="w-12 h-12 text-[#4F772D] mx-auto mb-3" />
          <h2 className="text-xl font-bold text-[#35531f] mb-2">Password Reset!</h2>
          <p className="text-[#35531f] text-sm">Your password has been reset. Redirecting to login...</p>
          <Link href="/login" className="theme-link mt-4 inline-block text-sm">
            Go to Login now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <h1 className="text-3xl font-bold mb-2 text-center theme-page-title">Reset Password</h1>
      <p className="theme-page-subtle text-sm text-center mb-6">Enter your new password below.</p>
      <form onSubmit={submit} className="theme-card space-y-4 p-6 rounded-[1.5rem]">
        <div>
          <label className="block text-sm font-medium mb-1 text-[#314b24]">New Password</label>
          <input
            type="password" required value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            className="theme-input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-[#314b24]">Confirm Password</label>
          <input
            type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Re-enter password"
            className="theme-input"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!token ? (
          <p className="text-sm text-center theme-page-subtle">
            <Link href="/forgot-password" className="theme-link">
              Request a new reset link
            </Link>
          </p>
        ) : (
          <button
            disabled={loading}
            className="theme-primary-btn w-full"
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
    <div className="app-shell">
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
