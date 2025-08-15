import jsPDF from "jspdf";
import "jspdf-autotable";

export function pdfDailyLog(rows: any[]) {
  const doc = new jsPDF();
  doc.text("Daily Log", 14, 16);
  (doc as any).autoTable({
    startY: 22,
    head: [["Date", "Shed", "Mortalities", "Culls", "Notes"]],
    body: rows.map(r => [r.date, r.shed ?? r.shedName ?? "", r.mortalities ?? 0, r.culls ?? 0, r.notes ?? ""])
  });
  doc.save("daily-log.pdf");
}

export function pdfWaterLogs(rows: any[]) {
  const doc = new jsPDF();
  doc.text("Water Chlorine Readings", 14, 16);
  (doc as any).autoTable({
    startY: 22,
    head: [["Date", "Reading (ppm)", "Notes"]],
    body: rows.map(r => [r.date, r.ppm ?? "", r.notes ?? ""])
  });
  doc.save("water-logs.pdf");
}
