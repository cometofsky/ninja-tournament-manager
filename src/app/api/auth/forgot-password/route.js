import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { buildPasswordResetEmail, getAppName } from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/mailer';

export const maxDuration = 10; // Vercel Hobby plan limit

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      user.resetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      user.resetTokenExpiry = new Date(Date.now() + 3600 * 1000);
      await user.save();

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');
      const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
      const message = buildPasswordResetEmail({
        resetUrl,
        expiresInHours: 1,
        appName: getAppName(),
      });

      try {
        await sendTransactionalEmail({
          to: user.email,
          ...message,
        });
      } catch (mailErr) {
        console.error('Mail send failed:', mailErr.message);
      }
    }

    // Always return success to prevent user enumeration
    return NextResponse.json({ success: true, message: 'If that email is registered, a reset link was sent.' });
  } catch (e) {
    console.error('Forgot password error:', e.message);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
