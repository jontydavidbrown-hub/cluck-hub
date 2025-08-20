import { Handler } from "@netlify/functions";
import { get, set } from "@netlify/blobs";

const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { farmId } = JSON.parse(event.body || "{}");
    if (!farmId) return { statusCode: 400, body: "farmId required" };

    // The keys you want to migrate (adjust to your schema)
    const keys = ["morts", "feed", "water", "weights", "dailyLogs"];

    for (const key of keys) {
      const oldKey = `data/${key}`;
      const newKey = `farm/${farmId}/${key}`;

      const res = await get(oldKey);
      if (res) {
        const value = await res.json();
        await set(newKey, JSON.stringify(value));
      }
    }

    return { statusCode: 200, body: "Migration complete" };
  } catch (err: any) {
    return { statusCode: 500, body: "Migration failed: " + err.message };
  }
};

export { handler };
