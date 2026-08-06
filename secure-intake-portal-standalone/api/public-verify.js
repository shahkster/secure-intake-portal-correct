import { audit, dbRequest } from "../server/db.js";
import { safeEqualText, sha256, verifyHash } from "../server/crypto.js";
import { createClientCookie } from "../server/session.js";
import { json, methodNotAllowed, readJson, sameOrigin } from "../server/http.js";
import { cleanName } from "../server/validation.js";

export const runtime = "nodejs";
export default {
  async fetch(request) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    if (!sameOrigin(request)) return json({ error: "Request blocked." }, 403);
    const body = await readJson(request);
    const token = String(body?.token || "");
    const lastName = cleanName(body?.lastName);
    if (token.length < 30 || !lastName) return json({ error: "Enter the last name on file." }, 400);
    try {
      const tokenHash = sha256(token);
      const rows = await dbRequest("intake_requests", {
        query: `token_hash=eq.${encodeURIComponent(tokenHash)}&select=id,last_name_verify_hash,status,attempts,expires_at`,
      });
      const row = rows?.[0];
      if (!row) return json({ error: "This link is invalid." }, 404);
      if (row.status !== "sent") return json({ error: "This link is no longer available." }, 410);
      if (row.attempts >= 3) return json({ error: "This link has been locked." }, 423);
      if (new Date(row.expires_at).getTime() <= Date.now()) return json({ error: "This link has expired." }, 410);

      const valid = safeEqualText(verifyHash(lastName), row.last_name_verify_hash);
      if (!valid) {
        const attempts = Math.min(3, row.attempts + 1);
        const locked = attempts >= 3;
        await dbRequest("intake_requests", {
          method: "PATCH",
          query: `id=eq.${encodeURIComponent(row.id)}`,
          body: { attempts, ...(locked ? { status: "locked" } : {}) },
          prefer: "return=minimal",
        });
        await audit(row.id, locked ? "verification_locked" : "verification_failed", { attempts });
        return json({
          error: locked ? "This link has been locked." : "That last name does not match our records.",
          attemptsRemaining: Math.max(0, 3 - attempts),
          locked,
        }, locked ? 423 : 401);
      }

      await dbRequest("intake_requests", {
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(row.id)}`,
        body: { opened_at: new Date().toISOString() },
        prefer: "return=minimal",
      });
      await audit(row.id, "identity_verified");
      return json({ ok: true }, 200, {
        "Set-Cookie": createClientCookie(request, row.id, tokenHash),
      });
    } catch {
      return json({ error: "Verification could not be completed." }, 500);
    }
  },
};
