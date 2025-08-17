// src/lib/csv.ts

// Rows may come from older data too; we normalize safely.
type Row = {
  id?: string;
  date?: string;                // YYYY-MM-DD
  shed?: string;
  morts?: number;
  cullRunts?: number;
  cullLegs?: number;
  cullNonStart?: number;
  cullOther?: number;
  culls?: number;               // legacy compatibility
  mortalities?: number;         // legacy compatibility
  notes?: string;
};

type Shed = {
  name?: string;
  placementDate?: string;       // YYYY-MM-DD
};

function num(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function sumCulls(r: Partial<Row>) {
  return num(r.cullRunts) + num(r.cullLegs) + num(r.cullNonStart) + num(r.cullOther);
}

function daysBetweenUTC(a?: string, b?: string) {
  if (!a || !b) return "";
  const A = new Date(a + "T00:00:00Z").getTime();
  const B = new Date(b + "T00:00:00Z").getTime();
  if (!Number.isFinite(A) || !Number.isFinite(B)) return "";
  return String(Math.floor((B - A) / (1000 * 60 * 60 * 24)));
}

function csvEscape(v: any): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCsv(
  filename: string,
  rows: Row[],
  sheds?: Shed[]
) {
  const byShedPlacement = new Map<string, string | undefined>();
  for (const s of sheds || []) {
    const k = (s?.name || "").trim();
    if (k) byShedPlacement.set(k, s?.placementDate);
  }

  const today = new Date().toISOString().slice(0, 10);

  const header = [
    "Date",
    "Shed",
    "Day Age",
    "Morts",
    "Cull Runts",
    "Cull Legs",
    "Cull Non-Start",
    "Cull Other",
    "Culls",
    "Mortalities",
    "Notes",
  ];

  const body = (rows || []).map((r) => {
    const morts = num(r.morts);
    const cullsTotal = sumCulls(r);
    const mortalities = num(r.mortalities) || morts + cullsTotal;
    const shedName = (r.shed || "").trim();
    const dayAge = daysBetweenUTC(byShedPlacement.get(shedName), r.date || today);

    return [
      r.date || "",
      shedName,
      dayAge,
      morts,
      num(r.cullRunts),
      num(r.cullLegs),
      num(r.cullNonStart),
      num(r.cullOther),
      cullsTotal,
      mortalities,
      r.notes || "",
    ];
  });

  const csv =
    header.map(csvEscape).join(",") +
    "\n" +
    body.map((row) => row.map(csvEscape).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "morts.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
