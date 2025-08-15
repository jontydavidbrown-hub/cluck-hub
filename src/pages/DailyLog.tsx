import { useMemo, useState } from "react";
import { useServerState } from "../lib/serverState";

// Adjust fields to taste
type DailyEntry = {
  id: string;
  date: string;       // ISO date
  shed: string;
  tempAM?: number | null;
  tempPM?: number | null;
  mortalities?: number | null;
  comments?: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyLog() {
  const { state: log, setState: setLog, loading, synced } =
    useServerState<DailyEntry[]>("dailyLog", []);

  const [form, setForm] = useState<DailyEntry>({
    id: "",
    date: todayISO(),
    shed: "",
    tempAM: null,
    tempPM: null,
    mortalities: null,
    comments: "",
  });

  const sorted = useMemo(
    () =>
      [...log].sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0)),
    [log]
  );

  function addEntry() {
    if (!form.shed) return;
    const entry: DailyEntry = { ...form, id: uid() };
    setLog([...log, entry]);
    setForm({
      id: "",
      date: todayISO(),
      shed: "",
      tempAM: null,
      tempPM: null,
      mortalities: null,
