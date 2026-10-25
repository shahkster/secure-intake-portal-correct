import { SignJWT, jwtVerify } from 'jose';

export type Session = {
  uid: string;
  role: 'boss' | 'agent';
  name: string;
  sv: number; // session version — bumping it logs the user out everywhere
  stage: 'full' | 'pending' | 'setup';
  mcp?: boolean; // must change password
};

const key = () => {
  const s = process.env.SESSION_SECRET || '';
  if (s.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return new TextEncoder().encode(s);
};

export async function signToken(s: Session, ttlSeconds: number) {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(key());
}

export async function verifyToken(token?: string): Promise<Session | null> {
  if (!token || (process.env.SESSION_SECRET || '').length < 32) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

/** Short-lived token for a client who passed the identity check on a secure link. */
export async function signClient(linkId: string, ttlSeconds = 20 * 60) {
  return new SignJWT({ cl: linkId }).setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds).sign(key());
}
export async function verifyClient(token?: string): Promise<string | null> {
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, key()); return (payload as any).cl ?? null; } catch { return null; }
}
