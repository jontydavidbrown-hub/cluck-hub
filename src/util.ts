
export function daysSince(dateStr?: string): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000*60*60*24))
  return diff
}
export function fmt(n: number | null | undefined, d=0): string {
  const v = typeof n === 'number' ? n : Number(n || 0)
  return v.toFixed(d)
}
