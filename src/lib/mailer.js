import nodemailer from 'nodemailer';
import { normalizeOptional, readEnv } from '@/lib/email/utils';

function parseBoolean(value) {
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

export function getDefaultMailFrom() {
  return normalizeOptional(readEnv('SMTP_FROM', 'MAIL_FROM')) || 'noreply@tournament.app';
}

export function createMailTransporter() {
  const host = normalizeOptional(readEnv('SMTP_HOST', 'MAIL_HOST')) || 'smtp.ethereal.email';
  const portValue = normalizeOptional(readEnv('SMTP_PORT', 'MAIL_PORT'));
  const port = Number(portValue);
  const user = normalizeOptional(readEnv('SMTP_USER', 'MAIL_USER'));
  const pass = normalizeOptional(readEnv('SMTP_PASS', 'MAIL_PASS'));

  return nodemailer.createTransport({
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    secure: parseBoolean(readEnv('SMTP_SECURE', 'MAIL_SECURE')),
    ...(user && pass ? { auth: { user, pass } } : {}),
  });
}

export async function sendTransactionalEmail({ to, from = getDefaultMailFrom(), subject, text, html }) {
  if (!to || !subject || (!text && !html)) {
    throw new Error('to, subject, and at least one email body format are required');
  }

  return createMailTransporter().sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}
