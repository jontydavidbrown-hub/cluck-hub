// src/lib/pdfWeights.ts
// Export a single (date, shed) weights session to PDF with summary and bucket table.

type Bucket = { id: string; weightKg?: number };
type WeightSession = {
  id: string;
  date: string;          // YYYY-MM-DD
  shed: string;
  birdsPerBucket: number;
  buckets: Bucket[];
};

type Shed = { name?: string };

function sum(arr: number[]) {
  return arr.reduce((a, n) => a + n, 0);
}

export async function pdfWeightsSession(
  session: WeightSession,
  opts?: { farmSheds?: Shed[]; filename?: string; title?: string }
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const filename =
    opts?.filename ??
    `weights_${(session.shed || "shed").replace(/\s+/g, "-")}_${session.date || "date"}.pdf`;
  const title = opts?.title ?? "Weights Summary";

  const weights = session.buckets.map(b => Number(b.weightKg) || 0).filter(n => n > 0);
  const totalBuckets = weights.length;
  const bpb = Math.max(0, Math.floor(session.birdsPerBucket || 0));
  const totalBirds = bpb * totalBuckets;
  const totalWeightKg = sum(weights);
  const avgPerBirdKg = totalBirds > 0 ? totalWeightKg / totalBirds : 0;

  const doc = new jsPDF({ orientation: "portrait" });
  doc.setFontSize(16);
  doc.text(title, 14, 16);

  doc.setFontSize(10);
  doc.text(`Date: ${session.date || "-"}`, 14, 24);
  doc.text(`Shed: ${session.shed || "-"}`, 70, 24);
  doc.text(`Birds/ Bucket: ${bpb}`, 120, 24);

  // Summary box
  autoTable(doc, {
    startY: 30,
    head: [["Metric", "Value"]],
    body: [
      ["Total buckets", String(totalBuckets)],
      ["Total birds", String(totalBirds)],
      ["Total weight (kg)", totalWeightKg.toFixed(3)],
      ["Average (kg/bird)", avgPerBirdKg > 0 ? avgPerBirdKg.toFixed(3) : "—"],
    ],
    styles: { fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [22, 163, 74] },
    theme: "striped",
  });

  // Buckets table
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [["Bucket #", "Weight (kg)", "Birds", "Avg (kg/bird)"]],
    body: session.buckets.map((b, i) => {
      const w = Number(b.weightKg) || 0;
      const avg = w > 0 && bpb > 0 ? w / bpb : 0;
      return [String(i + 1), w > 0 ? w.toFixed(3) : "—", String(bpb), avg > 0 ? avg.toFixed(3) : "—"];
    }),
    styles: { fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [22, 163, 74] },
    theme: "striped",
  });

  doc.save(filename);
}
