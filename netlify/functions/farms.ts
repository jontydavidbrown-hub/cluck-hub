import { Handler } from "@netlify/functions";
import { get, set } from "@netlify/blobs";

interface Farm {
  id: string;
  name: string;
  [key: string]: any;
}

const FARMS_KEY = "farms_list";

const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Load farms list
  let farms: Farm[] = [];
  const stored = await get(FARMS_KEY);
  if (stored) {
    farms = await stored.json();
  }

  // GET farms
  if (event.httpMethod === "GET") {
    return { statusCode: 200, headers, body: JSON.stringify(farms) };
  }

  // CREATE farm
  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body || "{}");
    if (!body.name) {
      return { statusCode: 400, headers, body: "Farm must have a name" };
    }
    const newFarm: Farm = { id: Date.now().toString(), ...body };
    farms.push(newFarm);
    await set(FARMS_KEY, JSON.stringify(farms));
    return { statusCode: 200, headers, body: JSON.stringify(newFarm) };
  }

  // DELETE farm
  if (event.httpMethod === "DELETE") {
    const body = JSON.parse(event.body || "{}");
    if (!body.id) {
      return { statusCode: 400, headers, body: "Farm id required" };
    }
    farms = farms.filter((f) => f.id !== body.id);
    await set(FARMS_KEY, JSON.stringify(farms));
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers, body: "Method Not Allowed" };
};

export { handler };
