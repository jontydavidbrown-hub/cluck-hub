
import { useEffect, useMemo, useState } from 'react'
import { get, set } from '../storage'

type Delivery = { shed:string; type:'Starter'|'Grower'|'Finisher'|'Booster'; tonnes:number; date:string }

export default function FeedSilos(){
  const [shed, setShed] = useState('')
  const sheds = get<string[]>('sheds', [])
  const [form, setForm] = useState<Delivery>({ shed:'', type:'Starter', tonnes:0, date:new Date().toISOString().slice(0,10) })
  const [deliveries, setDeliveries] = useState<Delivery[]>(get<Delivery[]>('deliveries', []))
  const alloc = get<Record<string, number>>('allocations', {}) // loads
  const allocTonnes: Record<string, number> = {
    Starter: (alloc['Starter']||0)*24,
    Grower: (alloc['Grower']||0)*24,
    Finisher: (alloc['Finisher']||0)*24,
  }

  useEffect(()=>{
    if (!shed && sheds.length) setShed(sheds[0])
    if (!form.shed && sheds.length) setForm(f => ({...f, shed: sheds[0]}))
  }, [sheds])

  function addDelivery(){
    const d: Delivery = { ...form, tonnes: Number(form.tonnes||0) }
    const next = [...deliveries, d]
    setDeliveries(next)
    set('deliveries', next)
  }

  const totals = useMemo(()=>{
    const base = { Starter:0, Grower:0, Finisher:0, Booster:0 }
    for(const d of deliveries){ base[d.type] += Number(d.tonnes||0) }
    return base
  }, [deliveries])

  const byShed = useMemo(()=>{
    const map: Record<string, {Starter:number;Grower:number;Finisher:number;Booster:number;Total:number}> = {}
    for (const s of sheds){ map[s] = {Starter:0, Grower:0, Finisher:0, Booster:0, Total:0} }
    for(const d of deliveries){
      const row = map[d.shed] || (map[d.shed] = {Starter:0, Grower:0, Finisher:0, Booster:0, Total:0})
      row[d.type] += Number(d.tonnes||0)
      row.Total += Number(d.tonnes||0)
    }
    return map
  }, [deliveries, sheds])

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-3">
        <div className="grid md:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-sm">Shed</span>
            <select value={form.shed} onChange={(e)=>setForm(f=>({...f, shed:e.target.value}))} className="w-full border rounded p-2 bg-white">
              {sheds.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm">Feed type</span>
            <select value={form.type} onChange={(e)=>setForm(f=>({...f, type:e.target.value as any}))} className="w-full border rounded p-2 bg-white">
              {['Starter','Grower','Finisher','Booster'].map(t=> <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm">Tonnes</span>
            <input type="number" inputMode="decimal" value={form.tonnes} onChange={(e)=>setForm(f=>({...f, tonnes: Number(e.target.value)}))} placeholder="e.g., 23.7" className="w-full border rounded p-2" />
          </label>
          <label className="block">
            <span className="text-sm">Date</span>
            <input type="date" value={form.date} onChange={(e)=>setForm(f=>({...f, date:e.target.value}))} className="w-full border rounded p-2" />
          </label>
        </div>
        <button onClick={addDelivery} className="mt-3 rounded bg-slate-900 text-white px-4 py-2">Add delivery</button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {(['Starter','Grower','Finisher'] as const).map(t => {
          const received = totals[t]
          const allocated = allocTonnes[t] || 0
          const remaining = allocated - received
          const over = remaining < 0
          return (
            <div key={t} className="rounded-lg border bg-white p-3">
              <div className="font-medium">{t}</div>
              <div className="text-sm text-slate-600">Allocated: <b>{allocated.toFixed(1)} t</b></div>
              <div className="text-sm text-slate-600">Received: <b>{received.toFixed(1)} t</b></div>
              <div className={"text-sm " + (over ? "text-rose-600" : "text-slate-600")}>
                {over ? <>Over by <b>{Math.abs(remaining).toFixed(1)} t</b></> : <>Remaining: <b>{remaining.toFixed(1)} t</b></>}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border bg-white p-3 overflow-x-auto">
        <div className="font-medium mb-2">Deliveries</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr><th className="text-left px-2 py-1">Date</th><th className="text-left px-2 py-1">Shed</th><th className="text-left px-2 py-1">Type</th><th className="text-left px-2 py-1">Tonnes</th></tr>
          </thead>
          <tbody>
            {deliveries.map((d,i)=>(
              <tr key={i} className="border-t">
                <td className="px-2 py-1">{d.date}</td>
                <td className="px-2 py-1">{d.shed}</td>
                <td className="px-2 py-1">{d.type}</td>
                <td className="px-2 py-1">{Number(d.tonnes||0).toFixed(2)}</td>
              </tr>
            ))}
            {deliveries.length===0 && <tr><td colSpan={4} className="px-2 py-3 text-slate-500">No deliveries yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border bg-white p-3 overflow-x-auto">
        <div className="font-medium mb-2">Per‑shed totals (t)</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr><th className="text-left px-2 py-1">Shed</th><th className="text-left px-2 py-1">Starter</th><th className="text-left px-2 py-1">Grower</th><th className="text-left px-2 py-1">Finisher</th><th className="text-left px-2 py-1">Booster</th><th className="text-left px-2 py-1">Total</th></tr>
          </thead>
          <tbody>
            {Object.entries(byShed).map(([s,row])=> (
              <tr key={s} className="border-t">
                <td className="px-2 py-1">{s}</td>
                <td className="px-2 py-1">{row.Starter.toFixed(2)}</td>
                <td className="px-2 py-1">{row.Grower.toFixed(2)}</td>
                <td className="px-2 py-1">{row.Finisher.toFixed(2)}</td>
                <td className="px-2 py-1">{row.Booster.toFixed(2)}</td>
                <td className="px-2 py-1">{row.Total.toFixed(2)}</td>
              </tr>
            ))}
            {Object.keys(byShed).length===0 && <tr><td colSpan={6} className="px-2 py-3 text-slate-500">No sheds.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
