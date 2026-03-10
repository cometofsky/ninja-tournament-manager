import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

export const maxDuration = 10; // Vercel Hobby plan limit

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    await connectDB();

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email: email.toLowerCase().trim(), passwordHash });

    return NextResponse.json(
      { success: true, user: { id: user._id, email: user.email } },
      { status: 201 }
    );
  } catch (e) {
    console.error('Register error:', e.message);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
