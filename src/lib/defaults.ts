// src/lib/defaults.ts
export type AppSettings = {
  batchLengthDays: number;
  [key: string]: any;
};

export const DEFAULT_SETTINGS: AppSettings = {
  batchLengthDays: 56, // adjust if your app expects a different default
};

export function normalizeSettings(input?: Partial<AppSettings> | null): AppSettings {
  const src = input ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...src,
    batchLengthDays: Number(src.batchLengthDays ?? DEFAULT_SETTINGS.batchLengthDays),
  };
}
