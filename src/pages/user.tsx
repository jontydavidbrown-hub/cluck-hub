// src/pages/User.tsx
import { useEffect, useState } from "react"

type Profile = {
  email: string
  displayName: string
  timezone: string
  marketingOptIn: boolean
  updatedAt: string
}

const BASE = import.meta.env.PROD ? window.location.origin : ""

export default function UserPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch(`${BASE}/.netlify/functions/user?action=get`, { credentials: "include" })
        if (!res.ok) throw new Error(`Load failed: ${res.status}`)
        const data = (await res.json()) as Profile
        if (mounted) setProfile(data)
      } catch (e: any) {
        if (mounted) setErr(e?.message || "Failed to load")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true); setErr(null)
    try {
      const res = await fetch(`${BASE}/.netlify/functions/user?action=update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          displayName: profile.displayName,
          timezone: profile.timezone,
          marketingOptIn: profile.marketingOptIn,
        }),
      })
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)
      const data = (await res.json()) as Profile
      setProfile(data)
    } catch (e: any) {
      setErr(e?.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>
  if (err) return <div style={{ padding: 16, color: "crimson" }}>{err}</div>
  if (!profile) return <div style={{ padding: 16 }}>No profile.</div>

  return (
    <div style={{ maxWidth: 560, margin: "24px auto", padding: 16 }}>
      <h1>User settings</h1>
      <p style={{ color: "#666" }}>{profile.email}</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          <div>Display name</div>
          <input
            type="text"
            value={profile.displayName}
            onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
            required
          />
        </label>

        <label>
          <div>Timezone</div>
          <input
            type="text"
            value={profile.timezone}
            onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
            placeholder="e.g. Australia/Brisbane"
            required
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={profile.marketingOptIn}
            onChange={(e) => setProfile({ ...profile, marketingOptIn: e.target.checked })}
          />
          Receive occasional product updates
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>

        <div style={{ fontSize: 12, color: "#777" }}>
          Last updated: {new Date(profile.updatedAt).toLocaleString()}
        </div>
      </form>
    </div>
  )
}
