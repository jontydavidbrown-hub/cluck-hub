// src/lib/cloud.ts
// Sync local app data to the logged-in user's account via serverless function.
// We store a single JSON bundle with known keys. Extend as needed.
import { getToken } from './auth';

export type CloudBundle = Record<string, unknown>;

const ENDPOINT = '/.netlify/functions/user-data';

export async function loadCloudBundle(): Promise<CloudBundle> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(ENDPOINT, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function saveCloudBundle(data: CloudBundle): Promise<void> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// Utility: load from localStorage and save to cloud in one call
export async function pushLocalToCloud(keys: string[]) {
  const bundle: CloudBundle = {};
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      bundle[k] = raw ? JSON.parse(raw) : null;
    } catch {
      bundle[k] = null;
    }
  }
  await saveCloudBundle(bundle);
}

// Utility: pull from cloud and write to localStorage (overwrites existing)
export async function pullCloudToLocal() {
  const bundle = await loadCloudBundle();
  Object.entries(bundle).forEach(([k, v]) => {
    localStorage.setItem(k, JSON.stringify(v));
  });
  return bundle;
}
