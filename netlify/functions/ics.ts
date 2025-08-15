import type { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const STORE = getStore(process.env.BLOB_STORE || "cluckhub");
type Farm = { id: string; name: string };

async function readJSON<T=any>(k:string): Promise<T|null> {
  const v = await STORE.get(k, { type: "json" }); return (v as T) ?? null;
}
function toICSDate(dateStr: string) { return dateStr.replace(/-/g, ""); }

export const handler: Handler = async (event) => {
  try {
    const params = new URLSearchParams(event.rawQuery || "");
    const farmId = params.get("farmId");
    if (!farmId) return { statusCode: 400, body: "Missing farmId" };

    const farm = await readJSON<Farm>(`farms/${farmId}.json`);
    if (!farm) return { statusCode: 404, body: "Farm not found" };

    const reminders = await readJSON<any[]>(`farmData/${farmId}/reminders.json`) || [];
    const sheds = await readJSON<any[]>(`farmData/${farmId}/sheds.json`) || [];

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//CluckHub//${farm.name}//EN`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH"
    ];

    for (const r of reminders) {
      if (!r?.date) continue;
      const uid = `rem-${farmId}-${r.id || Math.random().toString(36).slice(2)}`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${toICSDate(r.date)}T000000Z`,
        `DTSTART;VALUE=DATE:${toICSDate(r.date)}`,
        `SUMMARY:${(r.title || r.name || "Reminder").replace(/\n/g, " ")}`,
        "END:VEVENT"
      );
    }

    for (const s of sheds) {
      if (!s?.placementDate) continue;
      const uid = `shed-${farmId}-${s.id || Math.random().toString(36).slice(2)}`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${toICSDate(s.placementDate)}T000000Z`,
        `DTSTART;VALUE=DATE:${toICSDate(s.placementDate)}`,
        `SUMMARY:Shed placement — ${s.name || s.id}`,
        "END:VEVENT"
      );
    }

    lines.push("END:VCALENDAR");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${farm.name.replace(/\s+/g, "_")}.ics"`,
        "Cache-Control": "no-store"
      },
      body: lines.join("\r\n")
    };
  } catch (e:any) {
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};
