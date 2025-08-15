// src/lib/serverState.ts
import { useEffect, useRef, useState } from 'react'

type Options<T> = {
  /** Debounce ms before saving to server after setState */
  debounce?: number
  /** Optional transform/validate before save */
  sanitize?: (v: T) => T
}

/**
 * useServerState(key, initial)
 * - Loads JSON from server at `/.netlify/functions/data?key=${key}`
 * - Allows local updates, debounced POST back to the server
 * - Falls back to initial if nothing stored
 */
export function useServerState<T>(key: string, initial: T, opts: Options<T> = {}) {
  const { debounce = 500, sanitize } = opts
  const [state, setState] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [synced, setSynced] = useState(false)
  const saveTimer = useRef<number | null>(null)

  // Load once
  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/.netlify/functions/data?key=${encodeURIComponent(key)}`, {
          credentials: 'include',
        })
        if (!res.ok) throw new Error(`GET failed: ${res.status}`)
        const body = await res.json()
        if (!alive) return
        if (body?.value != null) {
          setState(body.value as T)
        } else {
          setState(initial)
        }
      } catch (e: any) {
        if (alive) setError(e?.message || 'Load error')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Debounced save whenever state changes (after initial load)
  const firstSave = useRef(true)
  useEffect(() => {
    if (loading) return
    if (firstSave.current) {
      firstSave.current = false
      return
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      try {
        const body = sanitize ? sanitize(state) : state
        const res = await fetch('/.netlify/functions/data?key=' + encodeURIComponent(key), {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        setSynced(res.ok)
      } catch {
        setSynced(false)
      }
    }, debounce) as unknown as number
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current) }
  }, [state, key, debounce, sanitize, loading])

  return { state, setState, loading, error, synced }
}
