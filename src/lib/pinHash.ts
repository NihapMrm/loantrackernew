// PIN storage format: "pbkdf2-sha256$<iterations>$<salt hex>$<hash hex>".
// v1 stored a bare unsalted SHA-256 hex digest; those still verify and are upgraded on unlock.

const ITERATIONS = 150_000;
const PREFIX = 'pbkdf2-sha256';

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map(h => parseInt(h, 16)));

export const isValidPin = (pin: string) => /^(\d{4}|\d{6})$/.test(pin);

export function isLegacyHash(stored: string): boolean {
  return /^[0-9a-f]{64}$/.test(stored);
}

async function sha256Hex(pin: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin)));
}

async function pbkdf2Hex(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toHex(bits);
}

/** Hash a PIN with a fresh random salt */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${PREFIX}$${ITERATIONS}$${toHex(salt)}$${await pbkdf2Hex(pin, salt, ITERATIONS)}`;
}

/** Check a PIN against a stored hash in either the current or the legacy format */
export async function verifyPinHash(pin: string, stored: string): Promise<boolean> {
  if (isLegacyHash(stored)) return (await sha256Hex(pin)) === stored;
  const [prefix, iter, saltHex, hashHex] = stored.split('$');
  if (prefix !== PREFIX || !iter || !saltHex || !hashHex) return false;
  return (await pbkdf2Hex(pin, fromHex(saltHex), Number(iter))) === hashHex;
}
