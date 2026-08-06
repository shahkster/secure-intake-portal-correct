import { requireAdmin } from "../server/auth.js";
import { audit, dbRequest } from "../server/db.js";
import { json, methodNotAllowed, sameOrigin } from "../server/http.js";

export const runtime = "nodejs";
export default {
  async fetch(request) {
    const auth = requireAdmin(request);
    if (auth.error) return auth.error;
    const id = new URL(request.url).searchParams.get("id");
    if (!/^[0-9a-f-]{36}$/i.test(id || "")) return json({ error: "Invalid request." }, 400);

    if (request.method === "DELETE") {
      if (!sameOrigin(request)) return json({ error: "Request blocked." }, 403);
      try {
        await audit(id, "request_deleted");
        await dbRequest("intake_requests", {
          method: "DELETE",
          query: `id=eq.${encodeURIComponent(id)}`,
          prefer: "return=minimal",
        });
        return json({ ok: true });
      } catch {
        return json({ error: "Could not delete the request." }, 500);
      }
    }

    return methodNotAllowed(["DELETE"]);
  },
};
