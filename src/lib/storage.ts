// src/lib/storage.ts
export async function dataGet<T = any>(key: string): Promise<T | undefined> {
  const r = await fetch(`/.netlify/functions/data?key=${encodeURIComponent(key)}`, {
    credentials: "include",
  });
  if (!r.ok) return undefined;
  const j = await r.json().catch(() => undefined) as any;
  return j && "value" in j ? (j.value as T) : undefined;
}

export async function dataSet(key: string, value: any): Promise<void> {
  await fetch(`/.netlify/functions/data?key=${encodeURIComponent(key)}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

export async function dataDelete(key: string): Promise<void> {
  await fetch(`/.netlify/functions/data?key=${encodeURIComponent(key)}`, {
    method: "DELETE",
    credentials: "include",
  }).catch(() => {});
}

