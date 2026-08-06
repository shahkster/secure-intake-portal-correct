import { requireAdmin } from "../server/auth.js";
import { audit, dbRequest } from "../server/db.js";
import { decryptObject, encryptObject, randomToken, sha256, verifyHash } from "../server/crypto.js";
import { expiryHours } from "../server/env.js";
import { json, methodNotAllowed, readJson, sameOrigin } from "../server/http.js";
import { cleanName } from "../server/validation.js";

export const runtime = "nodejs";

function publicStatus(row) {
  if (row.status === "sent" && new Date(row.expires_at).getTime() <= Date.now()) return "expired";
  return row.status;
}

export default {
  async fetch(request) {
    const auth = requireAdmin(request);
    if (auth.error) return auth.error;

    if (request.method === "GET") {
      try {
        const rows = await dbRequest("intake_requests", {
          query: "select=id,first_name_enc,last_name_enc,want_ssn,want_dob,want_bank,status,attempts,expires_at,created_at,submitted_at,viewed_at&order=created_at.desc&limit=200",
        });
        const requests = (rows || []).map((row) => {
          const first = decryptObject(row.first_name_enc)?.value || "Client";
          const last = decryptObject(row.last_name_enc)?.value || "";
          return {
            id: row.id,
            first,
            last,
            wantSSN: row.want_ssn,
            wantDOB: row.want_dob,
            wantBank: row.want_bank,
            status: publicStatus(row),
            attempts: row.attempts,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
            submittedAt: row.submitted_at,
            viewedAt: row.viewed_at,
          };
        });
        return json({ requests });
      } catch {
        return json({ error: "Could not load requests. Check the database setup." }, 500);
      }
    }

    if (request.method === "POST") {
      if (!sameOrigin(request)) return json({ error: "Request blocked." }, 403);
      const body = await readJson(request);
      const first = cleanName(body?.first);
      const last = cleanName(body?.last);
      const wantSSN = body?.wantSSN === true;
      const wantDOB = body?.wantDOB === true;
      const wantBank = body?.wantBank === true;
      if (!first || !last || (!wantSSN && !wantDOB && !wantBank)) {
        return json({ error: "Enter the client name and select at least one information type." }, 400);
      }

      const token = randomToken();
      const tokenHash = sha256(token);
      const expiresAt = new Date(Date.now() + expiryHours() * 60 * 60 * 1000).toISOString();
      try {
        const inserted = await dbRequest("intake_requests", {
          method: "POST",
          body: {
            token_hash: tokenHash,
            first_name_enc: encryptObject({ value: first }),
            last_name_enc: encryptObject({ value: last }),
            last_name_verify_hash: verifyHash(last),
            want_ssn: wantSSN,
            want_dob: wantDOB,
            want_bank: wantBank,
            expires_at: expiresAt,
          },
          prefer: "return=representation",
        });
        const row = inserted?.[0];
        if (!row) throw new Error("Insert returned no row.");
        await audit(row.id, "request_created", { requested: [wantSSN && "ssn", wantDOB && "dob", wantBank && "bank"].filter(Boolean) });
        const origin = new URL(request.url).origin;
        return json({
          request: {
            id: row.id,
            first,
            last,
            wantSSN,
            wantDOB,
            wantBank,
            status: "sent",
            createdAt: row.created_at,
            expiresAt,
          },
          link: `${origin}/r/${token}`,
        }, 201);
      } catch {
        return json({ error: "Could not create the request. Check the Supabase settings." }, 500);
      }
    }

    return methodNotAllowed(["GET", "POST"]);
  },
};
