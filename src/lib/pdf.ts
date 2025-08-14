// Weights PDF generator (no extra deps)
// Usage: generateWeightsPdf({ shed, birdsPerBucket, buckets, notes, createdAt })
import jsPDF from "jspdf";

type WeightsPdfInput = {
  shed: string;
  birdsPerBucket: number;
  buckets: number[]; // each item is total kg of bucket
  notes?: string;
  createdAt?: string; // ISO
};

export function generateWeightsPdf(input: WeightsPdfInput) {
  const { shed, birdsPerBucket, buckets, notes } = input;
  const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  const title = "Cluck Hub — Weight Report";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, W / 2, y, { align: "center" });
  y += 28;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const meta = [
    ["Shed", shed || "-"],
    ["Birds per bucket", String(birdsPerBucket || "-")],
    ["Entries", String(buckets.length)],
    ["Date", createdAt.toLocaleString()],
  ];

  // draw meta two columns
  const colX = [margin, W / 2];
  for (let i = 0; i < meta.length; i++) {
    const [k, v] = meta[i];
    const x = i < 2 ? colX[0] : colX[1];
    const row = i % 2;
    const yRow = y + row * 16;
    doc.setFont("helvetica", "bold"); doc.text(k + ":", x, yRow);
    doc.setFont("helvetica", "normal"); doc.text(v, x + 110, yRow);
  }
  y += 40;

  // table header
  const headers = ["#", "Bucket (kg)", "Birds", "Avg/bird (kg)"];
  const colW = [40, 120, 80, 120];
  const tableX = margin;
  let x = tableX;

  doc.setFont("helvetica", "bold");
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(tableX - 6, y - 14, sum(colW) + 12, 22); // header box

  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x, y);
    x += colW[i];
  }
  y += 12;
  doc.setFont("helvetica", "normal");

  // rows
  let totalKg = 0;
  let totalBirds = 0;

  const rowH = 18;
  for (let i = 0; i < buckets.length; i++) {
    const kg = buckets[i] ?? 0;
    const birds = birdsPerBucket || 0;
    const avg = birds > 0 ? kg / birds : 0;
    x = tableX;

    if (y + rowH > doc.internal.pageSize.getHeight() - margin - 120) {
      doc.addPage();
      y = margin;
    }

    doc.text(String(i + 1), x, y); x += colW[0];
    doc.text(fixed(kg, 3), x, y); x += colW[1];
    doc.text(String(birds), x, y); x += colW[2];
    doc.text(birds ? fixed(avg, 4) : "-", x, y);

    y += rowH;
    totalKg += kg;
    totalBirds += birds;
  }

  // totals
  const grandAvg = totalBirds > 0 ? totalKg / totalBirds : 0;
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Totals", tableX, y);
  doc.setFont("helvetica", "normal");
  y += 16;
  const totals = [
    ["Total buckets", String(buckets.length)],
    ["Total kg", fixed(totalKg, 3)],
    ["Total birds", String(totalBirds)],
    ["Average per bird (kg)", totalBirds ? fixed(grandAvg, 4) : "-"],
  ];
  for (const [k, v] of totals) {
    doc.text(`${k}: ${v}`, tableX, y);
    y += 16;
  }

  // notes & sign
  y += 10;
  if (notes) {
    doc.setFont("helvetica", "bold"); doc.text("Notes:", tableX, y);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(notes, W - margin * 2);
    y += 16;
    doc.text(wrapped, tableX, y);
    y += wrapped.length * 14;
  }

  y += 24;
  doc.text("Verified by: ____________________________", tableX, y);
  y += 24;
  doc.text(`Generated: ${createdAt.toLocaleString()}`, tableX, y);

  doc.save(makeFileName(`weights_${shed || "shed"}_${createdAt.toISOString().slice(0,10)}`));
}

function fixed(n: number, dp: number) {
  return (Math.round(n * 10**dp) / 10**dp).toFixed(dp);
}
function sum(a: number[]) { return a.reduce((s, n) => s + n, 0); }
function makeFileName(b: string) {
  return b.replace(/[^a-z0-9_\-]/gi, "_") + ".pdf";
}
