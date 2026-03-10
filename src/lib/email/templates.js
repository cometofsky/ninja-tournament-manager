import { renderActionEmailHtml, renderActionEmailText } from '@/lib/email/layout';
import { assertAbsoluteHttpUrl, getAppName, getExpiryText } from '@/lib/email/utils';

function buildActionEmail({
  subject,
  appName = getAppName(),
  previewText,
  eyebrow,
  title,
  lead,
  paragraphs,
  details,
  ctaLabel,
  ctaUrl,
  fallbackHint,
  footerLines,
}) {
  return {
    subject,
    html: renderActionEmailHtml({
      appName,
      previewText,
      eyebrow,
      title,
      lead,
      paragraphs,
      details,
      ctaLabel,
      ctaUrl,
      fallbackHint,
      footerLines,
    }),
    text: renderActionEmailText({
      title,
      lead,
      paragraphs,
      details,
      ctaLabel,
      ctaUrl,
      footerLines,
    }),
  };
}

export function buildPasswordResetEmail({ resetUrl, expiresInHours = 1, appName = getAppName() }) {
  const safeResetUrl = assertAbsoluteHttpUrl(resetUrl, 'resetUrl');
  const expiryText = getExpiryText(expiresInHours);

  return buildActionEmail({
    subject: `${appName} password reset`,
    appName,
    previewText: `Reset your ${appName} password. This link expires in ${expiryText}.`,
    eyebrow: 'Security alert',
    title: 'Reset your password',
    lead: `We received a request to reset the password for your ${appName} account.`,
    paragraphs: [
      'Use the secure button below to choose a new password.',
      "If you didn't request this, you can safely ignore this email. Your password will stay the same until you update it.",
    ],
    details: [`This reset link expires in ${expiryText}.`, 'For your protection, only use links sent directly from this app.'],
    ctaLabel: 'Reset password',
    ctaUrl: safeResetUrl,
    fallbackHint: "If the button doesn't work, copy and paste this secure link into your browser:",
    footerLines: [`Sent by ${appName}. This is an automated security email.`],
  });
}

export function buildEmailVerificationEmail({ verificationUrl, expiresInHours = 24, appName = getAppName() }) {
  const safeVerificationUrl = assertAbsoluteHttpUrl(verificationUrl, 'verificationUrl');
  const expiryText = getExpiryText(expiresInHours);

  return buildActionEmail({
    subject: `Verify your ${appName} email`,
    appName,
    previewText: `Confirm your email for ${appName}. This link expires in ${expiryText}.`,
    eyebrow: 'Account security',
    title: 'Verify your email address',
    lead: `Confirm your email address to finish setting up your ${appName} account.`,
    paragraphs: ['Once verified, you can securely access account recovery and important tournament updates.'],
    details: [`This verification link expires in ${expiryText}.`, 'Email verification helps protect your account from unauthorized access.'],
    ctaLabel: 'Verify email',
    ctaUrl: safeVerificationUrl,
    fallbackHint: 'If the button does not work, open this verification link directly:',
    footerLines: [`Sent by ${appName}. You can ignore this email if you did not create an account.`],
  });
}

export function buildWelcomeEmail({ dashboardUrl, appName = getAppName() }) {
  const safeDashboardUrl = assertAbsoluteHttpUrl(dashboardUrl, 'dashboardUrl');

  return buildActionEmail({
    subject: `Welcome to ${appName}`,
    appName,
    previewText: `Your ${appName} account is ready.`,
    eyebrow: 'Welcome aboard',
    title: 'Your account is ready',
    lead: `Welcome to ${appName}. You're all set to create tournaments, track brackets, and keep players moving.`,
    paragraphs: ['Start by creating your first tournament or reviewing the tournaments already available to your team.'],
    details: ['Use strong passwords and keep account recovery details up to date.', 'You can return to your dashboard anytime from the link below.'],
    ctaLabel: 'Open dashboard',
    ctaUrl: safeDashboardUrl,
    fallbackHint: 'If the button does not work, open your dashboard here:',
    footerLines: [`Sent by ${appName}. Welcome aboard.`],
  });
}

export function buildTournamentUpdateEmail({
  tournamentName,
  updateTitle,
  summary,
  details = [],
  tournamentUrl,
  appName = getAppName(),
}) {
  const safeTournamentUrl = assertAbsoluteHttpUrl(tournamentUrl, 'tournamentUrl');

  if (!tournamentName || !updateTitle || !summary) {
    throw new Error('tournamentName, updateTitle, and summary are required');
  }

  return buildActionEmail({
    subject: `${tournamentName}: ${updateTitle}`,
    appName,
    previewText: `${tournamentName} has a new update waiting for you.`,
    eyebrow: 'Tournament update',
    title: updateTitle,
    lead: `${tournamentName} has a new update in ${appName}.`,
    paragraphs: [summary],
    details,
    ctaLabel: 'View tournament',
    ctaUrl: safeTournamentUrl,
    fallbackHint: 'If the button does not work, open the tournament directly:',
    footerLines: [`Sent by ${appName}. You are receiving this because this tournament has activity.`],
  });
}
