import { useState } from "react";

export default function SignOutButton() {
  const [busy, setBusy] = useState(false);
  async function signOut() {
    try {
      setBusy(true);
      // Most setups expose logout via /auth?action=logout
      await fetch("/.netlify/functions/auth?action=logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    // Hard refresh to clear any client state
    window.location.href = "/";
  }
  return (
    <button
      onClick={signOut}
      disabled={busy}
      className="rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
      aria-label="Sign out"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
