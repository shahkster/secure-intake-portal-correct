import { requireAdmin } from "../server/auth.js";
import { audit, dbRequest } from "../server/db.js";
import { decryptObject } from "../server/crypto.js";
import { json, methodNotAllowed, sameOrigin } from "../server/http.js";

export const runtime = "nodejs";
export default {
  async fetch(request) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    if (!sameOrigin(request)) return json({ error: "Request blocked." }, 403);
    const auth = requireAdmin(request);
    if (auth.error) return auth.error;
    const id = new URL(request.url).searchParams.get("id");
    if (!/^[0-9a-f-]{36}$/i.test(id || "")) return json({ error: "Invalid request." }, 400);
    try {
      const rows = await dbRequest("intake_requests", {
        query: `id=eq.${encodeURIComponent(id)}&select=id,status,payload_enc,submitted_at`,
      });
      const row = rows?.[0];
      if (!row || row.status !== "submitted" || !row.payload_enc) {
        return json({ error: "No completed submission is available." }, 404);
      }
      const payload = decryptObject(row.payload_enc);
      await dbRequest("intake_requests", {
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(id)}`,
        body: { viewed_at: new Date().toISOString() },
        prefer: "return=minimal",
      });
      await audit(id, "submission_revealed");
      return json({ payload, submittedAt: row.submitted_at });
    } catch {
      return json({ error: "Could not open the submission." }, 500);
    }
  },
};
