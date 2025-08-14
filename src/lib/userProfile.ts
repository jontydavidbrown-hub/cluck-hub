// src/lib/userProfile.ts
export type Profile = {
  email: string
  displayName: string
  timezone: string
  marketingOptIn: boolean
  updatedAt: string
}

const BASE = import.meta.env.PROD ? window.location.origin : ""

export async function loadProfile(): Promise<Profile> {
  const res = await fetch(`${BASE}/.netlify/functions/user?action=get`, {
    credentials: "include",
  })
  if (!res.ok) throw new Error(`Profile load failed: ${res.status}`)
  return res.json()
}

export async function saveProfile(patch: Partial<Profile>): Promise<Profile> {
  const res = await fetch(`${BASE}/.netlify/functions/user?action=update`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Profile save failed: ${res.status}`)
  return res.json()
}
