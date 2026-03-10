import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

export const maxDuration = 10; // Vercel Hobby plan limit

export async function POST(req) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return NextResponse.json({ error: 'Token and new password required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    await connectDB();

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetToken: hashed,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    return NextResponse.json({ success: true, message: 'Password reset successfully. Please login.' });
  } catch (e) {
    console.error('Reset password error:', e.message);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
