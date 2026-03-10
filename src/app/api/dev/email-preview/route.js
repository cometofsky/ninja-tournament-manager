import { NextResponse } from 'next/server';
import {
  buildEmailVerificationEmail,
  buildPasswordResetEmail,
  buildTournamentUpdateEmail,
  buildWelcomeEmail,
} from '@/lib/email';

function buildPreviewTemplate(type, origin) {
  switch (type) {
    case 'verify-email':
      return buildEmailVerificationEmail({
        verificationUrl: `${origin}/verify-email?token=sample-verification-token`,
      });
    case 'welcome':
      return buildWelcomeEmail({
        dashboardUrl: `${origin}/tournaments/sample`,
      });
    case 'tournament-update':
      return buildTournamentUpdateEmail({
        tournamentName: 'Spring Invitational',
        updateTitle: 'Bracket updated after quarterfinals',
        summary: 'Quarterfinal results are in, and semifinal matchups are now ready to review.',
        details: ['Semifinal pairings have been generated.', 'Start times have been adjusted by 15 minutes.', 'Check the updated seeding before publishing.'],
        tournamentUrl: `${origin}/tournaments/sample`,
      });
    case 'password-reset':
    default:
      return buildPasswordResetEmail({
        resetUrl: `${origin}/reset-password?token=sample-reset-token`,
      });
  }
}

export async function GET(req) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const type = req.nextUrl.searchParams.get('type') || 'password-reset';
  const format = req.nextUrl.searchParams.get('format') || 'html';
  const template = buildPreviewTemplate(type, req.nextUrl.origin);

  if (format === 'text') {
    return new Response(template.text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return new Response(template.html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
