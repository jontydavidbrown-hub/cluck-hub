import { Handler } from "@netlify/functions";

interface Farm {
  id: string;
  name: string;
  [key: string]: any;
}

// Temporary in-memory storage
let farms: Farm[] = [];

const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // GET farms
  if (event.httpMethod === "GET") {
    return { statusCode: 200, headers, body: JSON.stringify(farms) };
  }

  // CREATE farm
  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      if (!body.name) {
        return { statusCode: 400, headers, body: "Farm must have a name" };
      }
      const newFarm: Farm = { id: Date.now().toString(), ...body };
      farms.push(newFarm);
      return { statusCode: 200, headers, body: JSON.stringify(newFarm) };
    } catch {
      return { statusCode: 400, headers, body: "Invalid farm data" };
    }
  }

  // DELETE farm
  if (event.httpMethod === "DELETE") {
    try {
      const body = JSON.parse(event.body || "{}");
      if (!body.id) {
        return { statusCode: 400, headers, body: "Farm id required" };
      }
      farms = farms.filter((f) => f.id !== body.id);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch {
      return { statusCode: 400, headers, body: "Invalid request" };
    }
  }

  return { statusCode: 405, headers, body: "Method Not Allowed" };
};

export { handler };
