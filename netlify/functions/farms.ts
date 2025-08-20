import { Handler } from "@netlify/functions";

interface Farm {
  id: string;
  name: string;
  [key: string]: any;
}

// Temporary in-memory store
// ⚠️ WARNING: Resets when Netlify function container restarts.
// Replace with a database (Firestore, Supabase, etc.) for true persistence.
let farms: Farm[] = [];

const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(farms),
    };
  }

  if (event.httpMethod === "POST") {
    try {
      const newFarm = JSON.parse(event.body || "{}");
      if (!newFarm.name) {
        return { statusCode: 400, body: "Farm must have a name" };
      }
      const farm: Farm = { id: Date.now().toString(), ...newFarm };
      farms.push(farm);

      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(farm),
      };
    } catch (err) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: "Invalid farm data",
      };
    }
  }

  return {
    statusCode: 405,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: "Method Not Allowed",
  };
};

export { handler };
