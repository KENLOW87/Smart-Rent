// Shared helpers for phone-based tenant login.
// Pure functions — safe to import from both client and server components.

export const TENANT_FAKE_DOMAIN = 'smartrent.local';

export function phoneToEmail(phone: string) {
  const clean = phone.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `${clean}@${TENANT_FAKE_DOMAIN}`;
}

// A tenant's password is derived from their phone number, so they only ever
// need to remember their phone. Padded to satisfy the 6-character minimum.
export function phoneToPassword(phone: string) {
  const digits = phone.replace(/[^a-zA-Z0-9]/g, '');
  return digits.length >= 6 ? digits : (digits + '000000').slice(0, 6);
}

export function looksLikePhone(input: string) {
  const t = input.trim();
  return t.length > 0 && /^[0-9+\-\s()]+$/.test(t);
}
