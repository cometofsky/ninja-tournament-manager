'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
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
    <div className="app-shell">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 flex items-center justify-center py-16">
        <div className="max-w-md w-full">
          {submitted ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Check Your Email</h1>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                If an admin account is registered for <strong className="text-slate-900 font-semibold">{email}</strong>, a password reset link has been dispatched.
              </p>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-500 mb-6">
                The reset link will expire in 60 minutes for security purposes.
              </div>
              <Link href="/login" className="theme-primary-btn w-full shadow-sm">
                <ArrowLeft className="w-4 h-4" /> Return to Login
              </Link>
            </div>
          ) : (
            <div>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Mail className="w-6 h-6" />
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Forgot Password</h1>
                <p className="text-slate-500 text-sm mt-1">
                  Enter your registered administrator email to receive reset instructions.
                </p>
              </div>

              <form onSubmit={submit} className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="theme-input"
                    placeholder="admin@tournament.org"
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
                  {loading ? 'Sending Instructions...' : 'Send Reset Link'}
                </button>

                <div className="pt-4 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-500">
                    Remember your credentials?{' '}
                    <Link href="/login" className="font-semibold text-emerald-700 hover:text-emerald-800">
                      Sign in
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
