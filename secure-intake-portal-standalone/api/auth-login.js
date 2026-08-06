import { requiredEnv } from "../server/env.js";
import { json, methodNotAllowed, readJson, sameOrigin } from "../server/http.js";
import { createAdminCookie } from "../server/session.js";
import { safeEqualText } from "../server/crypto.js";

export const runtime = "nodejs";
export default {
  async fetch(request) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    if (!sameOrigin(request)) return json({ error: "Request blocked." }, 403);
    const body = await readJson(request);
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const expectedEmail = requiredEnv("ADMIN_EMAIL").trim().toLowerCase();
    const expectedPassword = requiredEnv("ADMIN_PASSWORD");
    const valid = safeEqualText(email, expectedEmail) && safeEqualText(password, expectedPassword);
    if (!valid) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      return json({ error: "Incorrect email or password." }, 401);
    }
    return json({ ok: true, email: expectedEmail }, 200, {
      "Set-Cookie": createAdminCookie(request, expectedEmail),
    });
  },
};
