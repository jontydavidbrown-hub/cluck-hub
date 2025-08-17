// src/lib/pdfLogs.ts
// Creates a PDF table with the new morts/cull breakdown + day age.
// Uses jsPDF + jspdf-autotable (same libs your project likely already has).

type Row = {
  id?: string;
  date?: string;                // YYYY-MM-DD
  shed?: string;
  morts?: number;
  cullRunts?: number;
  cullLegs?: number;
  cullNonStart?: number;
  cullOther?: number;
  culls?: number;
  mortalities?: number;
  notes?: string;
};

type Shed = {
  name?: string;
  placementDate?: string;
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

export async function pdfDailyLog(
  rows: Row[],
  sheds?: Shed[],
  opts?: { title?: string; filename?: string }
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const byShedPlacement = new Map<string, string | undefined>();
  for (const s of sheds || []) {
    const k = (s?.name || "").trim();
    if (k) byShedPlacement.set(k, s?.placementDate);
  }
  const today = new Date().toISOString().slice(0, 10);

  const title = opts?.title ?? "Morts & Culls";
  const filename = opts?.filename ?? "morts.pdf";

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(title, 14, 16);

  // Table data
  const head = [[
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
  ]];

  let totalMorts = 0,
      totalRunts = 0,
      totalLegs = 0,
      totalNonStart = 0,
      totalOther = 0,
      totalCulls = 0,
      totalMortalities = 0;

  const body = (rows || []).map((r) => {
    const morts = num(r.morts);
    const runts = num(r.cullRunts);
    const legs = num(r.cullLegs);
    const nonStart = num(r.cullNonStart);
    const other = num(r.cullOther);
    const culls = runts + legs + nonStart + other;
    const mortalities = num(r.mortalities) || morts + culls;
    const shedName = (r.shed || "").trim();
    const dayAge = daysBetweenUTC(byShedPlacement.get(shedName), r.date || today);

    totalMorts += morts;
    totalRunts += runts;
    totalLegs += legs;
    totalNonStart += nonStart;
    totalOther += other;
    totalCulls += culls;
    totalMortalities += mortalities;

    return [
      r.date || "",
      shedName,
      dayAge,
      morts,
      runts,
      legs,
      nonStart,
      other,
      culls,
      mortalities,
      r.notes || "",
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: 22,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [22, 163, 74] }, // emerald-ish
    theme: "striped",
    didDrawPage: (data) => {
      // Footer with totals on each page bottom-right
      const pageSize = doc.internal.pageSize;
      const x = pageSize.getWidth() - 10;
      const y = pageSize.getHeight() - 10;

      const totals = `Totals — Morts: ${totalMorts} | Culls: ${totalCulls} (Runts ${totalRunts}, Legs ${totalLegs}, Non-Start ${totalNonStart}, Other ${totalOther}) | Mortalities: ${totalMortalities}`;
      doc.setFontSize(8);
      const w = doc.getTextWidth(totals);
      doc.text(totals, x - w, y);
    },
  });

  doc.save(filename);
}
