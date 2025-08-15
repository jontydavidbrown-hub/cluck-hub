import { useEffect, useState } from "react";

type Profile = Record<string, any>;

export default function User() {
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({});
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [synced, setSynced] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load session + profile
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // session
        const s = await fetch("/.netlify/functions/auth?action=session", {
          credentials: "include",
        });
        if (s.ok) {
          const sess = await s.json();
          if (alive) setEmail(sess?.email ?? null);
        } else if (alive) {
          setEmail(null);
        }

        // profile
        const r = await fetch("/.netlify/functions/user", {
          credentials: "include",
        });
        if (r.ok) {
          const data = await r.json();
          if (alive) {
            setProfile(data || {});
            setDisplayName((data?.displayName ?? "") as string);
            setPhone((data?.phone ?? "") as string);
            setNotes((data?.notes ?? "") as string);
          }
        } else if (alive) {
          setProfile({});
        }
      } catch (e: any) {
        if (alive) setError(e?.message || "Load error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function save() {
    try {
      setSaving(true);
      setSynced(null);
      setError(null);
      // Merge back into original profile so unknown keys are preserved
      const body = {
        ...profile,
        displayName,
        phone,
        notes,
      };
      const res = await fetch("/.netlify/functions/user", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setSynced(res.ok);
      if (res.ok) setProfile(body);
      if (!res.ok) {
        const msg = await safeText(res);
        setError(msg || `Save failed (${res.status})`);
      }
    } catch (e: any) {
      setSynced(false);
      setError(e?.message || "Save error");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    try {
      await fetch("/.netlify/functions/auth?action=logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    window.location.href = "/";
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">User</h1>
        <button
          onClick={signOut}
          className="rounded-lg border px-3 py-2 text-sm"
          aria-label="Sign out"
        >
          Sign out
        </button>
      </header>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : (
        <>
          <div className="bg-white border rounded-xl p-4">
            <div className="text-sm text-slate-600">
              <b>Status:</b>{" "}
              {email ? (
                <span>Signed in as <span className="font-medium">{email}</span></span>
              ) : (
                <span className="text-red-600">Not signed in</span>
              )}
            </div>
          </div>

          <div className="bg-white border rounded-xl p-4">
            <h2 className="font-semibold mb-3">Profile</h2>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-sm text-slate-500">Display name</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="border rounded p-2 w-full"
                  placeholder="Your name"
                />
              </label>

              <label className="block">
                <span className="text-sm text-slate-500">Phone</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="border rounded p-2 w-full"
                  placeholder="Optional"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm text-slate-500">Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border rounded p-2 w-full"
                  rows={4}
                  placeholder="Anything you want to remember"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-slate-900 text-white px-4 py-2 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              {synced === true && (
                <span className="text-xs px-2 py-1 rounded border border-green-200 bg-green-50 text-green-700">
                  Saved
                </span>
              )}
              {synced === false && (
                <span className="text-xs px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700">
                  Not saved
                </span>
              )}
              {error && <span className="text-xs text-red-600">{error}</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

async function safeText(res: Response) {
  try { return await res.text(); } catch { return ""; }
}
