// src/lib/defaults.ts

// Keep this type loose so we don't break other dynamic settings you add later.
export type AppSettings = {
  // required in many places (batch progress etc.)
  batchLengthDays: number;

  // everything else is optional/extendable
  [key: string]: any;
};

// Single source of truth for defaults
export const DEFAULT_SETTINGS: AppSettings = {
  batchLengthDays: 56, // <- safe default (8-week batch). Change if your app expects a different number.
};

// Ensure every time we load/patch settings, required keys exist
export function normalizeSettings(input?: Partial<AppSettings> | null): AppSettings {
  const src = input ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...src,
    // coerce to number if someone saved a string by accident
    batchLengthDays: Number(src.batchLengthDays ?? DEFAULT_SETTINGS.batchLengthDays),
  };
}
