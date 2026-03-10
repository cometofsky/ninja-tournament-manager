const DEFAULT_APP_NAME = 'Tournament Manager';

export function readEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

export function normalizeOptional(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed || ['null', 'undefined'].includes(trimmed.toLowerCase())) {
    return undefined;
  }

  return trimmed;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function assertAbsoluteHttpUrl(value, fieldName = 'url') {
  try {
    const url = new URL(String(value));
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Unsupported protocol');
    }
    return url.toString();
  } catch {
    throw new Error(`${fieldName} must be a valid absolute HTTP(S) URL`);
  }
}

export function getAppName() {
  return normalizeOptional(readEnv('APP_NAME')) || DEFAULT_APP_NAME;
}

export function getExpiryText(hours) {
  const normalizedHours = Number(hours);
  if (!Number.isFinite(normalizedHours) || normalizedHours <= 0) {
    throw new Error('expiresInHours must be a positive number');
  }

  return `${normalizedHours} hour${normalizedHours === 1 ? '' : 's'}`;
}
