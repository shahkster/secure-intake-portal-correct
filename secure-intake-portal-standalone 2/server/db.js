import { requiredEnv } from "./env.js";

function headers(prefer) {
  const key = requiredEnv("SUPABASE_SECRET_KEY");
  const h = {
    apikey: key,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  // Legacy service-role keys are JWTs and need Authorization. New sb_secret keys do not.
  if (key.startsWith("eyJ")) h.Authorization = `Bearer ${key}`;
  if (prefer) h.Prefer = prefer;
  return h;
}

export async function dbRequest(table, { method = "GET", query = "", body, prefer } = {}) {
  const base = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const url = `${base}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const response = await fetch(url, {
    method,
    headers: headers(prefer),
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) {
    const error = new Error(`Database request failed (${response.status}).`);
    error.status = response.status;
    error.detail = data;
    throw error;
  }
  return data;
}

export async function audit(requestId, eventType, metadata = {}) {
  try {
    await dbRequest("intake_audit_events", {
      method: "POST",
      body: { request_id: requestId, event_type: eventType, metadata },
      prefer: "return=minimal",
    });
  } catch {
    // Audit failure should not expose sensitive details to the caller.
  }
}
