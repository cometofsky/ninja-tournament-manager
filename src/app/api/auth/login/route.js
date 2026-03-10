import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { signToken } from '@/lib/auth';

export const maxDuration = 10; // Vercel Hobby plan limit

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Constant-time comparison to prevent user enumeration
    const dummyHash = '$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const ok = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, dummyHash);

    if (!user || !ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signToken({ sub: user._id, role: user.role, email: user.email });

    return NextResponse.json({ token, user: { id: user._id, email: user.email, role: user.role } });
  } catch (e) {
    console.error('Login error:', e.message);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
