export function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function expiryHours() {
  const parsed = Number(process.env.REQUEST_EXPIRY_HOURS || 48);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 168 ? parsed : 48;
}
