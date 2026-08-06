import { json, methodNotAllowed } from "../server/http.js";
import { getAdminSession } from "../server/session.js";

export const runtime = "nodejs";
export default {
  async fetch(request) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    const session = getAdminSession(request);
    return session
      ? json({ authenticated: true, email: session.email })
      : json({ authenticated: false }, 401);
  },
};
