'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Request failed');
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
        {submitted ? (
          <div className="max-w-md mx-auto py-16 text-center">
            <div className="bg-green-50 border border-green-200 rounded-xl p-8">
              <Mail className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-green-800 mb-2">Check your email</h2>
              <p className="text-green-700 text-sm">
                If <strong>{email}</strong> is registered, a password reset link has been sent. It expires in 1 hour.
              </p>
              <Link href="/login" className="mt-4 inline-block text-indigo-600 text-sm hover:underline">
                Back to Login
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto py-12">
            <h1 className="text-3xl font-bold mb-2 text-center">Forgot Password</h1>
            <p className="text-gray-500 text-sm text-center mb-6">Enter your email and we&apos;ll send a reset link.</p>
            <form onSubmit={submit} className="space-y-4 bg-white p-6 rounded-xl shadow">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="you@example.com"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60 font-medium"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <p className="text-sm text-center">
                Remember it?{' '}
                <Link href="/login" className="text-indigo-600 hover:underline">Login</Link>
              </p>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
