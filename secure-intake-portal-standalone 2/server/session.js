import crypto from "node:crypto";
import { requiredEnv } from "./env.js";

const ADMIN_COOKIE = "sip_admin";
const CLIENT_COOKIE = "sip_client";

function sign(encoded) {
  return crypto.createHmac("sha256", requiredEnv("SESSION_SECRET"))
    .update(encoded)
    .digest("base64url");
}

function makeSigned(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function readSigned(token) {
  if (!token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  const expected = sign(encoded);
  const a = Buffer.from(signature || "", "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(request) {
  const raw = request.headers.get("cookie") || "";
  const out = {};
  for (const part of raw.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function cookieString(name, value, request, maxAge) {
  const secure = new URL(request.url).protocol === "https:";
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : "",
    `Max-Age=${maxAge}`,
  ].filter(Boolean).join("; ");
}

export function createAdminCookie(request, email) {
  const maxAge = 12 * 60 * 60;
  const value = makeSigned({ type: "admin", email, exp: Date.now() + maxAge * 1000 });
  return cookieString(ADMIN_COOKIE, value, request, maxAge);
}

export function clearAdminCookie(request) {
  return cookieString(ADMIN_COOKIE, "", request, 0);
}

export function getAdminSession(request) {
  const payload = readSigned(parseCookies(request)[ADMIN_COOKIE]);
  return payload?.type === "admin" ? payload : null;
}

export function createClientCookie(request, requestId, tokenHash) {
  const maxAge = 30 * 60;
  const value = makeSigned({ type: "client", requestId, tokenHash, exp: Date.now() + maxAge * 1000 });
  return cookieString(CLIENT_COOKIE, value, request, maxAge);
}

export function clearClientCookie(request) {
  return cookieString(CLIENT_COOKIE, "", request, 0);
}

export function getClientSession(request) {
  const payload = readSigned(parseCookies(request)[CLIENT_COOKIE]);
  return payload?.type === "client" ? payload : null;
}
