
import { useEffect, useMemo, useState } from 'react'
import { get, set } from '../storage'

function useQuery() { return new URLSearchParams(window.location.search) }

type Mort = { shed:string; date:string; deads:number; runtCulls:number; legCulls:number }

export default function DailyLog(){
  const sheds = get<string[]>('sheds', [])
  const q = useQuery()

  const [shed, setShed] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [deads, setDeads] = useState<number | ''>('')
  const [runt, setRunt] = useState<number | ''>('')
  const [leg, setLeg] = useState<number | ''>('')
  const [log, setLog] = useState<Mort[]>(get<Mort[]>('morts', []))

  useEffect(()=>{
    const qshed = q.get('shed')
    if (qshed) setShed(qshed)
    else if (!shed && sheds.length) setShed(sheds[0])
  }, [sheds])

  function add(){
    const entry: Mort = {
      shed,
      date,
      deads: Number(deads || 0),
      runtCulls: Number(runt || 0),
      legCulls: Number(leg || 0),
    }
    const next = [...log, entry]
    setLog(next); set('morts', next)
    setDeads(''); setRunt(''); setLeg('')
  }

  const todays = useMemo(()=> log.filter(m => m.shed===shed && m.date===date), [log, shed, date])
  const todaysTotal = todays.reduce((a,m)=> a + m.deads + m.runtCulls + m.legCulls, 0)
  const cumul = useMemo(()=> log.filter(m=>m.shed===shed), [log, shed])
  const cumulTotal = cumul.reduce((a,m)=> a + m.deads + m.runtCulls + m.legCulls, 0)

  const birdsPlaced = get<Record<string, number>>('birdsPlaced', {})
  const placed = birdsPlaced[shed] || 0
  const mortPct = placed>0 ? (cumulTotal/placed)*100 : 0

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-3">
        <div className="grid md:grid-cols-5 gap-3">
          <label className="block">
            <span className="text-sm">Shed</span>
            <select value={shed} onChange={(e)=>setShed(e.target.value)} className="w-full border rounded p-2 bg-white">
              {sheds.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm">Date</span>
            <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-full border rounded p-2" />
          </label>
          <label className="block">
            <span className="text-sm">Morts (Deads)</span>
            <input type="number" inputMode="numeric" value={deads as any} onChange={(e)=>setDeads(e.target.value===''?'':Number(e.target.value))} className="w-full border rounded p-2" />
          </label>
          <label className="block">
            <span className="text-sm">Runt Culls</span>
            <input type="number" inputMode="numeric" value={runt as any} onChange={(e)=>setRunt(e.target.value===''?'':Number(e.target.value))} className="w-full border rounded p-2" />
          </label>
          <label className="block">
            <span className="text-sm">Leg Culls</span>
            <input type="number" inputMode="numeric" value={leg as any} onChange={(e)=>setLeg(e.target.value===''?'':Number(e.target.value))} className="w-full border rounded p-2" />
          </label>
        </div>
        <button onClick={add} className="mt-3 rounded bg-slate-900 text-white px-4 py-2">Add to log</button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-white p-3">
          <div className="text-sm text-slate-500">Today ({date})</div>
          <div className="text-2xl font-semibold">{todaysTotal}</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-sm text-slate-500">Cumulative ({shed})</div>
          <div className="text-2xl font-semibold">{cumulTotal}</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-sm text-slate-500">Mortality % vs placed</div>
          <div className="text-2xl font-semibold">{mortPct.toFixed(2)}%</div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-3 overflow-x-auto">
        <div className="font-medium mb-2">Entries for {shed}</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr><th className="text-left px-2 py-1">Date</th><th className="text-left px-2 py-1">Deads</th><th className="text-left px-2 py-1">Runt Culls</th><th className="text-left px-2 py-1">Leg Culls</th><th className="text-left px-2 py-1">Total</th></tr>
          </thead>
          <tbody>
            {cumul.sort((a,b)=> a.date.localeCompare(b.date)).map((m,i)=>(
              <tr key={i} className="border-t">
                <td className="px-2 py-1">{m.date}</td>
                <td className="px-2 py-1">{m.deads}</td>
                <td className="px-2 py-1">{m.runtCulls}</td>
                <td className="px-2 py-1">{m.legCulls}</td>
                <td className="px-2 py-1">{(m.deads+m.runtCulls+m.legCulls)}</td>
              </tr>
            ))}
            {cumul.length===0 && <tr><td colSpan={5} className="px-2 py-3 text-slate-500">No entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
