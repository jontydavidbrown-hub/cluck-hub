export type AppSettings = {
  /** Days from placement to batch end */
  batchLengthDays: number;
  /** IANA TZ name used for reminders/formatting */
  timezone?: string;
  /** Display units for water logs */
  waterUnits?: "L" | "gal";
};

export const DEFAULT_SETTINGS: AppSettings = {
  batchLengthDays: 42,
  timezone: "Australia/Brisbane",
  waterUnits: "L",
};

export function normalizeSettings(
  s?: Partial<AppSettings> | null
): AppSettings {
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}
