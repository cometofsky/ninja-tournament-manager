const ADMIN_TOKEN_KEY = 'adminToken';

function parseJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = parts[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function isTokenExpired(token) {
  if (!token) return true;

  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now;
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.dispatchEvent(new Event('auth-change'));
}

export function getStoredAdminToken() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) return null;

  if (isTokenExpired(token)) {
    clearAdminToken();
    return null;
  }

  return token;
}

export function getAdminAuthHeader() {
  const token = getStoredAdminToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}
