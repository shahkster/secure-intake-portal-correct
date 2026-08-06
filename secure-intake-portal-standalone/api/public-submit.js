import { audit, dbRequest } from "../server/db.js";
import { encryptObject, safeEqualText, sha256 } from "../server/crypto.js";
import { clearClientCookie, getClientSession } from "../server/session.js";
import { json, methodNotAllowed, readJson, sameOrigin } from "../server/http.js";
import { digitsOnly, validDob, validRouting } from "../server/validation.js";

export const runtime = "nodejs";
export default {
  async fetch(request) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    if (!sameOrigin(request)) return json({ error: "Request blocked." }, 403);
    const body = await readJson(request);
    const token = String(body?.token || "");
    const session = getClientSession(request);
    const tokenHash = sha256(token);
    if (!session || !safeEqualText(session.tokenHash, tokenHash)) {
      return json({ error: "Please verify your identity again." }, 401);
    }

    try {
      const rows = await dbRequest("intake_requests", {
        query: `id=eq.${encodeURIComponent(session.requestId)}&token_hash=eq.${encodeURIComponent(tokenHash)}&select=id,want_ssn,want_dob,want_bank,status,expires_at`,
      });
      const row = rows?.[0];
      if (!row || row.status !== "sent") return json({ error: "This link is no longer available." }, 410);
      if (new Date(row.expires_at).getTime() <= Date.now()) return json({ error: "This link has expired." }, 410);

      const dob = String(body?.dob || "");
      const ssn = digitsOnly(body?.ssn);
      const routing = digitsOnly(body?.routing);
      const account = digitsOnly(body?.account);

      if (row.want_dob && !validDob(dob)) {
        return json({ error: "Enter a valid date of birth." }, 400);
      }
      if (row.want_ssn && ssn.length !== 9) {
        return json({ error: "Enter a valid nine-digit Social Security number." }, 400);
      }
      if (row.want_bank && (!validRouting(routing) || account.length < 4 || account.length > 17)) {
        return json({ error: "Enter a valid nine-digit routing number and account number." }, 400);
      }

      const payload = {
        dob: row.want_dob ? dob : null,
        ssn: row.want_ssn ? ssn : null,
        routing: row.want_bank ? routing : null,
        account: row.want_bank ? account : null,
      };
      const submittedAt = new Date().toISOString();
      const updated = await dbRequest("intake_requests", {
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(row.id)}&status=eq.sent`,
        body: { payload_enc: encryptObject(payload), status: "submitted", submitted_at: submittedAt },
        prefer: "return=representation",
      });
      if (!updated?.[0]) return json({ error: "This link has already been used." }, 410);
      await audit(row.id, "submission_received", { fields: [row.want_ssn && "ssn", row.want_dob && "dob", row.want_bank && "bank"].filter(Boolean) });
      return json({ ok: true }, 200, { "Set-Cookie": clearClientCookie(request) });
    } catch {
      return json({ error: "Your information could not be submitted." }, 500);
    }
  },
};
