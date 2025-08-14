
import { useEffect, useMemo, useState } from 'react'
import { get } from '../storage'
import { daysSince } from '../util'
import { useNavigate } from 'react-router-dom'

export default function Dashboard(){
  const sheds = get<string[]>('sheds', [])
  const placements = get<Record<string,string>>('placements', {})
  const cycleDays = get<number>('cycleDays', 49)
  const birdsPlaced = get<Record<string, number>>('birdsPlaced', {})
  const morts = get<Array<any>>('morts', []) as Array<{shed:string; date:string; deads:number; runtCulls:number; legCulls:number}>

  const nav = useNavigate()

  const shedStats = useMemo(() => {
    return sheds.map(s => {
      const dayAge = daysSince(placements[s] || undefined) ?? 0
      const pctRaw = Math.round((dayAge / cycleDays) * 100)
      const pct = Math.max(0, pctRaw)
      const pctBar = Math.min(100, pct)
      const tileColor = pct > 100 ? 'bg-rose-500' : 'bg-orange-500'

      const shedMorts = morts.filter(m => m.shed === s)
      const totalMorts = shedMorts.reduce((acc, m) => acc + (m.deads||0) + (m.runtCulls||0) + (m.legCulls||0), 0)
      const placed = birdsPlaced[s] || 0
      const mortPct = placed > 0 ? ((totalMorts/placed)*100) : 0

      return { shed: s, dayAge, pct, pctBar, tileColor, placement: placements[s] || '', totalMorts, mortPct }
    })
  }, [sheds, placements, cycleDays, birdsPlaced, morts])

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {shedStats.map(info => (
        <div key={info.shed} className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Shed {info.shed}</div>
            <div className="text-xs text-slate-500">Placed {info.placement || '—'}</div>
          </div>

          <div className="w-full h-6 bg-slate-200 rounded-full overflow-hidden mb-2 relative">
            <div className={`h-full ${info.tileColor}`} style={{width: info.pctBar + '%'}} />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
              {info.pct}%
            </div>
          </div>
          <div className="text-sm text-slate-700 mb-3">Day age: <b>{info.dayAge}</b></div>

          <div className="flex items-center justify-between text-sm">
            <div>Morts: <b>{info.totalMorts}</b> <span className="text-slate-500">({info.mortPct.toFixed(2)}%)</span></div>
            <div className="flex gap-2">
              <button onClick={()=>nav(`/daily-log?shed=${encodeURIComponent(info.shed)}`)} className="text-xs rounded border px-2 py-1">Add Morts</button>
              <button onClick={()=>nav(`/weights?shed=${encodeURIComponent(info.shed)}`)} className="text-xs rounded border px-2 py-1">Add Weights</button>
            </div>
          </div>
        </div>
      ))}
      {shedStats.length === 0 && <p className="text-sm text-slate-500">Add sheds in Setup to see tiles here.</p>}
    </div>
  )
}
