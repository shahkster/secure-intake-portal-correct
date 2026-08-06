import { json, methodNotAllowed, sameOrigin } from "../server/http.js";
import { clearAdminCookie } from "../server/session.js";

export const runtime = "nodejs";
export default {
  async fetch(request) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    if (!sameOrigin(request)) return json({ error: "Request blocked." }, 403);
    return json({ ok: true }, 200, { "Set-Cookie": clearAdminCookie(request) });
  },
};
