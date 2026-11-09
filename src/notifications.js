const DEVICE_KEY = 'attn-reminder-device-v1';

export function phoneNotificationSupport() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return { needsInstall: ios && !installed, supported: isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window };
}

export async function reminderService() {
  const response = await fetch('/reminder-service.json', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Could not check the reminder service. Try again online.');
  const config = await response.json();
  if (!config.apiBase) return null;
  const url = new URL(config.apiBase);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('The reminder connection needs HTTPS.');
  const base = url.origin;
  const health = await serviceRequest(base, '/config');
  return { ...health, base };
}

export function deviceCredential() {
  try { return localStorage.getItem(DEVICE_KEY); } catch { return null; }
}
export function saveDeviceCredential(credential) {
  if (credential) localStorage.setItem(DEVICE_KEY, credential);
  else localStorage.removeItem(DEVICE_KEY);
}
export async function serviceRequest(base, path, { method = 'GET', body, credential } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, cache: 'no-store', signal: AbortSignal.timeout(12000),
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Could not reach the reminder service. Try again online.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function applicationServerKey(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}
