import { getAdminSession } from "./session.js";
import { json } from "./http.js";

export function requireAdmin(request) {
  const session = getAdminSession(request);
  if (!session) return { error: json({ error: "Please sign in." }, 401) };
  return { session };
}
