// src/lib/session.ts
// Client helpers for calling the credential auth Netlify function.
//
// Improved error surfacing: includes HTTP status + response text for easier debugging.
export type MeResponse = { email: string | null };

const BASE = import.meta.env.PROD ? window.location.origin : ""; // keep relative; use Netlify Dev or same-origin production. (Set to your site URL only if needed.)

async function request(method: "GET" | "POST", action: string, body?: any) {
  let res: Response;
  try {
    res = await fetch(`${BASE}/.netlify/functions/auth?action=${encodeURIComponent(action)}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });
  } catch (e: any) {
    throw new Error(e?.message || "Network error");
  }

  if (!res.ok) {
    const txt = await res.text();
    let msg = txt;
    try {
      const j = JSON.parse(txt);
      msg = j.error || txt;
    } catch {}
    throw new Error(`HTTP ${res.status} – ${msg || "Request failed"}`);
  }

  // Prefer JSON
  return res.json();
}

export async function signup(email: string, password: string) {
  return request("POST", "signup", { email, password });
}

export async function login(email: string, password: string) {
  return request("POST", "login", { email, password });
}

export async function logout() {
  return request("POST", "logout");
}

export async function me(): Promise<MeResponse> {
  return request("GET", "me");
}
