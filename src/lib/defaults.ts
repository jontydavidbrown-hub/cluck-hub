export type AppSettings = {
  batchLengthDays: number;
  timezone?: string;
  waterUnits?: "L" | "gal";
};

export const DEFAULT_SETTINGS: AppSettings = {
  batchLengthDays: 42,
  timezone: "Australia/Brisbane",
  waterUnits: "L",
};

export function normalizeSettings(s?: Partial<AppSettings> | null): AppSettings {
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}
