import { audit, dbRequest } from "../server/db.js";
import { decryptObject, sha256 } from "../server/crypto.js";
import { json, methodNotAllowed } from "../server/http.js";

export const runtime = "nodejs";
export default {
  async fetch(request) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    const token = new URL(request.url).searchParams.get("token") || "";
    if (token.length < 30 || token.length > 100) return json({ error: "This link is invalid." }, 404);
    try {
      const tokenHash = sha256(token);
      const rows = await dbRequest("intake_requests", {
        query: `token_hash=eq.${encodeURIComponent(tokenHash)}&select=id,first_name_enc,want_ssn,want_dob,want_bank,status,attempts,expires_at`,
      });
      const row = rows?.[0];
      if (!row) return json({ error: "This link is invalid." }, 404);
      if (row.status === "submitted") return json({ state: "completed", message: "This link has already been used." }, 410);
      if (row.status === "locked" || row.attempts >= 3) return json({ state: "locked", message: "This link has been locked." }, 423);
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        await dbRequest("intake_requests", {
          method: "PATCH",
          query: `id=eq.${encodeURIComponent(row.id)}`,
          body: { status: "expired" },
          prefer: "return=minimal",
        });
        await audit(row.id, "request_expired");
        return json({ state: "expired", message: "This link has expired." }, 410);
      }
      const firstName = decryptObject(row.first_name_enc)?.value || "there";
      return json({
        state: "ready",
        firstName,
        wantSSN: row.want_ssn,
        wantDOB: row.want_dob,
        wantBank: row.want_bank,
        expiresAt: row.expires_at,
      });
    } catch {
      return json({ error: "The request could not be loaded." }, 500);
    }
  },
};
