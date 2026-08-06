import crypto from "node:crypto";
import { requiredEnv } from "./env.js";

function encryptionKey() {
  const key = Buffer.from(requiredEnv("DATA_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

export function encryptObject(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptObject(value) {
  if (!value) return null;
  const [version, ivB64, tagB64, dataB64] = String(value).split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted payload.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8"));
}

export function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function verifyHash(value) {
  return crypto.createHmac("sha256", requiredEnv("VERIFY_PEPPER"))
    .update(String(value).trim().toLowerCase())
    .digest("hex");
}

export function safeEqualText(a, b) {
  const left = crypto.createHash("sha256").update(String(a)).digest();
  const right = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}
