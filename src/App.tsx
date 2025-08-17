export async function me() {
  const r = await fetch("/.netlify/functions/auth?action=me", { credentials: "include" });
  if (!r.ok) return null;             // 401 -> null
  return await r.json();              // { email, ... }
}
export async function login(email: string, password: string) {
  const r = await fetch("/.netlify/functions/auth?action=login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error((await r.json()).error || "Login failed");
  return await r.json();
}
export async function signup(email: string, password: string) {
  const r = await fetch("/.netlify/functions/auth?action=signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error((await r.json()).error || "Signup failed");
  return await r.json();
}
export async function logout() {
  await fetch("/.netlify/functions/auth?action=logout", { method: "POST", credentials: "include" });
}
function App() {
  // ...everything...
}

export default App;   // << add this if it’s missing
