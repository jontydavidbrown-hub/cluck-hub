import type { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { Resend } from "resend";

const STORE = getStore(process.env.BLOB_STORE || "cluckhub");
const resend = new Resend(process.env.RESEND_API_KEY || "");

type Role = "owner"|"manager"|"worker"|"viewer";
type Member = { email: string; role: Role };
type Farm = { id: string; name: string; ownerEmail: string; members: Member[]; createdAt?: string };

async function readJSON<T=any>(k:string): Promise<T|null> {
  const v = await STORE.get(k, { type: "json" }); return (v as T) ?? null;
}
async function listFarmIds(): Promise<string[]> {
  const idx = (await readJSON<{ids:string[]}>("farms/index.json")) || { ids: [] };
  return idx.ids;
}
function isDueToday(dateStr: string, tz: string = "Australia/Brisbane") {
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
    return dateStr?.slice(0,10) === today;
  } catch { return false; }
}

export const handler: Handler = async () => {
  if (!process.env.RESEND_API_KEY) {
    return { statusCode: 200, body: "RESEND_API_KEY not set — skipping." };
  }

  const farmIds = await listFarmIds();
  for (const id of farmIds) {
    const farm = await readJSON<Farm>(`farms/${id}.json`);
    if (!farm) continue;

    const reminders = await readJSON<any[]>(`farmData/${id}/reminders.json`) || [];
    const due = reminders.filter(r => r?.date && !r?.done && isDueToday(r.date));
    if (due.length === 0) continue;

    const recipients = farm.members.map(m => m.email);
    const html = `
      <div>
        <h2>Reminders due today for ${farm.name}</h2>
        <ul>${due.map((r:any)=>`<li>${r.title || r.name || "Reminder"} — ${r.date}</li>`).join("")}</ul>
      </div>
    `;

    try {
      await resend.emails.send({
        from: "Cluck Hub <noreply@yourdomain>",
        to: recipients,
        subject: `Today's reminders — ${farm.name}`,
        html
      });
    } catch (e:any) {
      console.error("Email error", e?.message);
    }
  }

  return { statusCode: 200, body: "ok" };
};
