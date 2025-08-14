import type React from "react";

import { useEffect, useRef, useState } from 'react'
import { get, set } from '../storage'

type Alloc = { Starter?: number; Grower?: number; Finisher?: number }

export default function Setup() {
  const [sheds, setSheds] = useState<string[]>([])
  const [placements, setPlacements] = useState<Record<string,string>>({})
  const [birdsPlaced, setBirdsPlaced] = useState<Record<string, number | ''>>({})
  const [alloc, setAlloc] = useState<Alloc>({})
  const [cycleDays, setCycleDays] = useState<number | ''>('' as any)
  const refs = useRef<Array<HTMLInputElement|null>>([])
  const [savedTick, setSavedTick] = useState(false)

  useEffect(() => {
    setSheds(get<string[]>('sheds', []))
    setPlacements(get<Record<string,string>>('placements', {}))
    const bp = get<Record<string, number>>('birdsPlaced', {})
    const initBP: Record<string, number | ''> = {}
    Object.keys(bp).forEach(k => { initBP[k] = bp[k] })
    setBirdsPlaced(initBP)
    setAlloc(get<Alloc>('allocations', {}))
    const cd = get<number>('cycleDays', 49)
    setCycleDays(cd || '')
  }, [])

  function addShed(focus: boolean = true) {
    setSheds((s) => [...s, ''])
    if (focus) setTimeout(() => refs.current[refs.current.length - 1]?.focus(), 0)
  }
  function updateShed(i: number, val: string) {
    setSheds((s) => s.map((x, idx) => idx === i ? val : x))
  }
  function removeShed(i: number) {
    setSheds((s) => s.filter((_, idx) => idx !== i))
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (sheds[i]?.trim()) addShed(true)
    }
  }

  function updatePlacement(shed: string, date: string) {
    setPlacements(p => ({...p, [shed]: date}))
  }
  function updateBirdsPlaced(shed: string, val: string) {
    const n = val === '' ? '' : Number(val)
    setBirdsPlaced(b => ({...b, [shed]: n}))
  }

  function updateAlloc(field: keyof Alloc, val: string) {
    const n = val === '' ? undefined : Number(val)
    setAlloc(a => ({...a, [field]: n}))
  }

  function save() {
    // clean sheds
    const cleanSheds = sheds.map(s => s.trim()).filter(Boolean)
    set('sheds', cleanSheds)

    // placements only for existing sheds
    const nextPlacements: Record<string,string> = {}
    cleanSheds.forEach(s => { if (placements[s]) nextPlacements[s] = placements[s] })
    set('placements', nextPlacements)

    // birds placed
    const bp: Record<string, number> = {}
    cleanSheds.forEach(s => {
      const v = birdsPlaced[s]
      if (typeof v === 'number' && !Number.isNaN(v)) bp[s] = v
    })
    set('birdsPlaced', bp)

    // allocations (loads counts)
    set('allocations', alloc)

    // cycle length
    const cd = typeof cycleDays === 'number' ? cycleDays : 49
    set('cycleDays', cd)

    // Saved tick
    setSavedTick(true)
    setTimeout(()=>setSavedTick(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-3">
        <div className="font-medium mb-1">Sheds</div>
        <p className="text-sm text-slate-500">Type just the number or name. Press <b>Enter</b> to add another input.</p>
        <div className="space-y-2 mt-2">
          {sheds.map((s, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
              <input
                ref={(el)=>refs.current[i]=el}
                value={s}
                onChange={(e)=>updateShed(i, e.target.value)}
                onKeyDown={(e)=>onKey(e, i)}
                placeholder={String(i+1)}
                className="border rounded p-2"
              />
              <input
                type="date"
                value={placements[s] || ''}
                onChange={(e)=>updatePlacement(s, e.target.value)}
                className="border rounded p-2"
                placeholder="Placement date"
              />
              <input
                type="number"
                inputMode="numeric"
                value={birdsPlaced[s] ?? ''}
                onChange={(e)=>updateBirdsPlaced(s, e.target.value)}
                placeholder="Birds placed"
                className="border rounded p-2"
              />
              <button onClick={()=>removeShed(i)} className="rounded border px-2 py-2 text-sm">Remove</button>
            </div>
          ))}
          {sheds.length === 0 && (
            <button onClick={()=>addShed(true)} className="rounded border px-3 py-2 text-sm">Add first shed</button>
          )}
        </div>
        <div className="flex gap-2 mt-3 items-center">
          <button onClick={save} className={"rounded px-4 py-2 text-white " + (savedTick ? "bg-emerald-600" : "bg-slate-900")}>
            {savedTick ? "Saved ✅" : "Save"}
          </button>
          <button onClick={()=>addShed(true)} className="rounded border px-3 py-2">Add Shed</button>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-3">
        <div className="font-medium mb-1">Feed allocations (loads × 24 t)</div>
        <div className="grid sm:grid-cols-3 gap-3">
          {(['Starter','Grower','Finisher'] as const).map(k => (
            <div key={k}>
              <label className="text-sm block mb-1">{k}</label>
              <input
                type="number"
                inputMode="numeric"
                value={typeof alloc[k] === 'number' ? alloc[k] : ''}
                onChange={(e)=>updateAlloc(k, e.target.value)}
                placeholder="Loads e.g., 3"
                className="w-full border rounded p-2"
              />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <label className="text-sm block mb-1">Default cycle length (days)</label>
          <input
            type="number"
            inputMode="numeric"
            value={typeof cycleDays === 'number' ? cycleDays : ''}
            onChange={(e)=>setCycleDays(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="49"
            className="w-40 border rounded p-2"
          />
        </div>
        <div className="mt-3">
          <button onClick={save} className={"rounded px-4 py-2 text-white " + (savedTick ? "bg-emerald-600" : "bg-slate-900")}>
            {savedTick ? "Saved ✅" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
