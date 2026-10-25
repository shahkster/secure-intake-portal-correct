import crypto from 'crypto';

function key() {
  const k = Buffer.from(process.env.ENCRYPTION_KEY || '', 'base64');
  if (k.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return k;
}

// AES-256-GCM. Stored as iv.tag.ciphertext (base64 parts).
export function encrypt(plain: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64')).join('.');
}

export function decrypt(enc: string) {
  const [iv, tag, ct] = enc.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

export function tempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(14);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
