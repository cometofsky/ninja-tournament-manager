import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable must be set in production.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret';
export const TOKEN_TTL = '8h';

/**
 * Sign a JWT token.
 * @param {object} payload
 * @returns {string}
 */
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/**
 * Verify a JWT token string.
 * @param {string} token
 * @returns {object} decoded payload
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Extract and verify the Bearer token from a Request.
 * Returns { user } on success or { error, status } on failure.
 * @param {Request} req
 */
export function authenticateRequest(req) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return { error: 'Missing Authorization header', status: 401 };
  }
  try {
    const user = verifyToken(token);
    return { user };
  } catch {
    return { error: 'Invalid or expired token', status: 401 };
  }
}

/**
 * Middleware helper: authenticate + require admin role.
 * Returns { user } or a NextResponse error.
 * @param {Request} req
 */
export function requireAdmin(req) {
  const result = authenticateRequest(req);
  if (result.error) {
    return { response: NextResponse.json({ error: result.error }, { status: result.status }) };
  }
  if (result.user?.role !== 'admin') {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user: result.user };
}
