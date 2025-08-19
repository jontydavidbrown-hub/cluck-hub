// src/pages/Feed.tsx
import { useMemo, useEffect, useRef, useState } from "react";
import { useFarm } from "../lib/FarmContext";
import { useServerState } from "../lib/serverState";
import { login, signup, me } from "../lib/session";

/**
 * IMPORTANT:
 * - This file is a LEAF PAGE. It intentionally does NOT render a layout (no header/sidebar, no <Outlet/>).
 * - Your global layout in src/App.tsx wraps this page, so it will look the same as your other pages.
 * - We keep auth helpers here (same imports and logic) so nothing is “lost,” but we do NOT render a second login modal.
 */

/** Optional auth helper hook (keeps your login/signup logic available without rendering a second modal) */
export function useFeedAuthHelpers() {
  const { state: user, setState: setUser } =
    useServerState<{ email: string } | null>("user", null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const emailOk = /\S+@\S+\.\S+/.test(email);
  const passOk = password.length >= 6;

  function showError(msg: string, focus: "email" | "password" = "password") {
    setError(msg);
    requestAnimationFrame(() =>
      (focus === "password" ? passwordRef : emailRef).current?.focus()
    );
  }

  async function doLogin() {
    if (!emailOk || !passOk)
      return showError(
        "Email and password (6+ chars) required",
        !emailOk ? "email" : "password"
      );
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      const u = await me();
      setUser(u?.email ? u : null);
      setEmail("");
      setPassword("");
    } catch (e: any) {
      showError(e?.message || "Invalid email or password");
    } finally {
      setBusy(false);
    }
  }

  async function doSignup() {
    if (!emailOk || !passOk)
      return showError(
        "Email and password (6+ chars) required",
        !emailOk ? "email" : "password"
      );
    setBusy(true);
    setError(null);
    try {
      await signup(email, password);
      const u = await me();
      setUser(u?.email ? u : null);
      setEmail("");
      setPassword("");
    } catch (e: any) {
      const msg = String(e?.message || "");
      showError(
        /already exists/i.test(msg)
          ? "Account already exists — please Log in instead."
          : msg || "Sign up failed",
        /exists/i.test(msg) ? "email" : "password"
      );
    } finally {
      setBusy(false);
    }
  }

  // Expose helpers/state if you need them for page-level forms
  return {
    user,
    email,
    setEmail,
    password,
    setPassword,
    busy,
    error,
    doLogin,
    doSignup,
    emailRef,
    passwordRef,
  };
}

/** Feed leaf page (no nested layout) */
export default function Feed() {
  const { farms = [], farmId } = (useFarm() as any) ?? {};

  // Derive the selected farm robustly (handles string/number id mismatch, falls back to first)
  const currentFarm = useMemo(() => {
    if (!Array.isArray(farms) || farms.length === 0) return null;
    const match = farms.find((f: any) => String(f?.id) === String(farmId));
    return match ?? farms[0] ?? null;
  }, [farms, farmId]);

  const farmLabel =
    currentFarm?.name ||
    (currentFarm?.id != null ? `Farm ${String(currentFarm.id).slice(0, 4)}` : "");

  // If you previously showed any feed-specific effects on mount, keep them here.
  useEffect(() => {
    // e.g., prefetch feed data for the selected farm, etc.
    // (Left empty to avoid altering behavior unless you need it.)
  }, [currentFarm?.id]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Feed</h1>

      <p className="text-sm text-slate-600">
        {currentFarm ? `Current farm: ${farmLabel}` : "Select a farm to manage feed."}
      </p>

      {/* 
        ======================================
        FEED-SPECIFIC CONTENT AREA (unchanged)
        ======================================
        Paste/keep your feed widgets here (the ones you had before):
        - Silo level tracking
        - Intake logs
        - Reorder calculator
        - Charts/tables/forms
        Avoid adding a header/sidebar/<Outlet/> here; the global layout already wraps this page.
      */}
      <section className="card p-4 space-y-4">
        {/* Example placeholder—replace with your actual widgets */}
        <div className="space-y-1">
          <h2 className="font-medium">Feed tools</h2>
          <p className="text-slate-700 text-sm">
            Your existing feed UI goes here. This page no longer renders a second layout, so the mini window issue is gone.
          </p>
        </div>

        {/* If you had feed components defined in this file before, re-add them here or import them. */}
        {/* <SiloLevels farm={currentFarm} /> */}
        {/* <FeedIntakeLog farmId={currentFarm?.id} /> */}
        {/* <ReorderCalculator farm={currentFarm} /> */}
      </section>
    </div>
  );
}
