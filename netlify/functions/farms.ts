import type { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import * as jwt from "jsonwebtoken";

const STORE = getStore(process.env.BLOB_STORE || "cluckhub");
const COOKIE = "cluckhub_session";
const JWT_SECRET = process.env.AUTH_JWT_SECRET || "";

type Role = "owner"|"manager"|"worker"|"viewer";
type Member = { email: string; role: Role };
type Farm = { id: string; name: string; ownerEmail: string; members: Member[]; createdAt?: string };

function parseCookies(header?: string | null): Record<string,string> {
  const out: Record<string,string> = {};
  if (!header) return out;
  header.split(";").forEach(p => {
    const [k, ...rest] = p.trim().split("="); if (!k) return;
    out[k] = decodeURIComponent(rest.join("=") || "");
  });
  return out;
}
function json(status:number, body:any){
  return { statusCode: status, headers: {
    "Content-Type":"application/json",
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Methods":"GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type, Authorization",
    "Access-Control-Allow-Credentials":"true",
  }, body: JSON.stringify(body) };
}
function text(status:number, body:string){ return json(status, { message: body }); }
function id() { return "farm_" + Math.random().toString(36).slice(2, 10); }

async function readJSON<T=any>(k:string): Promise<T|null> {
  // Netlify blobs: use get(..., { type: "json" }) for reads
  const v = await STORE.get(k, { type: "json" });
  return (v as T) ?? null;
}
async function writeJSON(k:string, v:any){
  // Netlify blobs: use setJSON for writes
  await STORE.setJSON(k, v);
}

async function getUser(event:any): Promise<{email:string}|null> {
  const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie);
  const token = cookies[COOKIE]; if (!token || !JWT_SECRET) return null;
  try { const d:any = jwt.verify(token, JWT_SECRET); return d?.email ? { email: d.email } : null; }
  catch { return null; }
}
async function getFarm(id:string): Promise<Farm|null> { return await readJSON<Farm>(`farms/${id}.json`); }
async function saveFarm(f:Farm){ await writeJSON(`farms/${f.id}.json`, f); }
function canManage(me:Member|null){ return !!me && (me.role==="owner"||me.role==="manager"); }

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return text(204, "");

  const user = await getUser(event);
  if (!user) return json(401, { error: "Not authenticated" });

  // List farms for user
  if (event.httpMethod === "GET" && event.path.endsWith("/farms")) {
    const idx = (await readJSON<{ids:string[]}>("farms/index.json")) || { ids: [] };
    const farms: Farm[] = [];
    for (const fid of idx.ids) {
      const f = await getFarm(fid); if (!f) continue;
      if (f.members.some(m => m.email === user.email)) farms.push(f);
    }
    return json(200, { ok: true, farms });
  }

  // Create farm
  if (event.httpMethod === "POST" && event.path.endsWith("/farms")) {
    const body = JSON.parse(event.body || "{}");
    const name = (body.name || "").toString().trim();
    if (!name) return json(400, { error: "Name required" });

    const f: Farm = {
      id: id(), name, ownerEmail: user.email,
      members: [{ email: user.email, role: "owner" }],
      createdAt: new Date().toISOString(),
    };
    const idx = (await readJSON<{ids:string[]}>("farms/index.json")) || { ids: [] };
    idx.ids.push(f.id);
    await writeJSON("farms/index.json", idx);
    await saveFarm(f);
    return json(200, { ok: true, farm: f });
  }

  // Member ops
  const m = event.path.match(/\/farms\/([^/]+)\/members$/);
  if (m) {
    const farmId = m[1];
    const farm = await getFarm(farmId);
    if (!farm) return json(404, { error: "Farm not found" });
    const me = farm.members.find(m => m.email === user.email) || null;
    if (!me) return json(403, { error: "Not a member" });
    if (!canManage(me)) return json(403, { error: "Insufficient role" });

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const email = (body.email || "").toLowerCase();
      const role: Role = body.role || "viewer";
      if (!email) return json(400, { error: "Email required" });
      const ex = farm.members.find(m => m.email === email);
      if (ex) ex.role = role; else farm.members.push({ email, role });
      await saveFarm(farm); return json(200, { ok: true });
    }

    if (event.httpMethod === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      const email = (body.email || "").toLowerCase();
      const role: Role = body.role || "viewer";
      const mem = farm.members.find(m => m.email === email);
      if (!mem) return json(404, { error: "Member not found" });
      mem.role = role; await saveFarm(farm); return json(200, { ok: true });
    }

    if (event.httpMethod === "DELETE") {
      const body = JSON.parse(event.body || "{}");
      const email = (body.email || "").toLowerCase();
      farm.members = farm.members.filter(m => m.email !== email);
      await saveFarm(farm); return json(200, { ok: true });
    }
  }

  return json(405, { error: "Method not allowed" });
};
