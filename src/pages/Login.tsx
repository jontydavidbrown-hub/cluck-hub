import { useEffect, useState } from "react";
import { createAuth0Client, Auth0Client } from "@auth0/auth0-spa-js";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to your .env file and Netlify env vars.\n` +
      `Required:\nVITE_AUTH0_DOMAIN=your-tenant.us.auth0.com\nVITE_AUTH0_CLIENT_ID=...\nVITE_AUTH0_AUDIENCE=https://cluckhub-api`
    );
  }
  return value;
}

export default function Login() {
  const [client, setClient] = useState<Auth0Client | null>(null);
  const [user, setUser] = useState<any>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const DOMAIN = requireEnv("VITE_AUTH0_DOMAIN", import.meta.env.VITE_AUTH0_DOMAIN);
        const CLIENT_ID = requireEnv("VITE_AUTH0_CLIENT_ID", import.meta.env.VITE_AUTH0_CLIENT_ID);
        const AUDIENCE = requireEnv("VITE_AUTH0_AUDIENCE", import.meta.env.VITE_AUTH0_AUDIENCE);

        const c = await createAuth0Client({
          domain: DOMAIN,
          clientId: CLIENT_ID,
          authorizationParams: {
            audience: AUDIENCE,
            redirect_uri: window.location.origin + "/login",
          },
        });
        setClient(c);

        if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
          await c.handleRedirectCallback();
          window.history.replaceState({}, document.title, "/login");
        }

        if (await c.isAuthenticated()) {
          const profile = await c.getUser();
          setUser(profile);
          setMsg(`Signed in as ${profile?.email || profile?.name || "user"} ✓`);
        }
      } catch (e:any) {
        console.error(e);
        setMsg(e?.message || "Auth0 init failed");
      }
    })();
  }, []);

  async function signIn() {
    if (!client) return;
    await client.loginWithRedirect();
  }
  async function signOut() {
    if (!client) return;
    await client.logout({ logoutParams: { returnTo: window.location.origin + "/login" } });
    setUser(null);
    setMsg("Logged out");
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Account</h1>
      {!user ? (
        <button className="bg-black text-white rounded px-4 py-2" onClick={signIn}>
          Sign in with Auth0
        </button>
      ) : (
        <div className="space-y-3">
          <div className="text-sm">
            Signed in as <span className="font-medium">{user?.email || user?.name}</span>
          </div>
          <button className="border rounded px-4 py-2" onClick={signOut}>
            Log out
          </button>
        </div>
      )}
      {msg && <div className="text-sm text-blue-700 whitespace-pre-wrap">{msg}</div>}
    </div>
  );
}
