import { useMemo } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type Settings = Record<string, any>;

export default function Setup() {
  const [settings, setSettings] = useCloudSlice<Settings>("settings", {});

  // helper: update numeric field while preserving others
  function setNum<K extends string>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const n = Number(raw);
      const next = Number.isFinite(n) ? n : 0;
      setSettings((prev: Settings) => ({ ...prev, [key]: next }));
    };
  }

  const otherNumericKeys = useMemo(() => {
    return Object.keys(settings || {})
      .filter((k) => k !== "batchLengthDays")
      .filter((k) => typeof settings[k] === "number")
      .sort();
  }, [settings]);

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Setup</h1>

      {/* Batch settings */}
      <div className="card p-4">
        <div className="font-medium mb-3">Batch settings</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-1">Batch length (days)</label>
            <input
              type="number"
              min={1}
              placeholder="0"
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              value={settings.batchLengthDays ?? ""}
              onChange={(e) => {
                const n = Math.max(1, Number(e.target.value || 1));
                setSettings((prev: Settings) => ({ ...prev, batchLengthDays: n }));
              }}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Controls defaults used across logs and reminders. You can adjust this any time.
        </p>
      </div>

      {/* Any other numeric settings already present */}
      {otherNumericKeys.length > 0 && (
        <div className="card p-4">
          <div className="font-medium mb-3">Other numeric settings</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherNumericKeys.map((key) => (
              <div key={key}>
                <label className="block text-sm mb-1">{labelize(key)}</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full border rounded px-2 py-1 placeholder-transparent"
                  value={settings[key] ?? ""}
                  onChange={setNum(key)}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-600">
            These fields are shown because they already exist as numbers in your settings.
          </p>
        </div>
      )}
    </div>
  );
}

function labelize(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}
