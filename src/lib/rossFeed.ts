// src/lib/rossFeed.ts
// Ross 308 / 308 FF — As-Hatched “Daily Intake (g/bird/day)” by age in days.
// Index 0 is unused; day 1..56 are filled.
export const ROSS308_AS_HATCHED_DAILY_G: number[] = [
  NaN, // 0 (unused)
  12, 16, 20, 24, 27, 31, 35, 39, 44, 48, 52, 57, 62, 67, 72, 77, 83, 88, 94, 100,
  105, 111, 117, 122, 128, 134, 139, 145, 150, 156, 161, 166, 171, 176, 180, 185,
  189, 193, 197, 201, 204, 207, 211, 213, 216, 219, 221, 223, 225, 227, 229, 230,
  231, 233, 233, 234
];

// Clamp to 1..56 and return g/bird/day
export function rossDailyIntakeG(ageDays: number): number {
  const d = Math.max(1, Math.min(56, Math.floor(ageDays || 1)));
  return ROSS308_AS_HATCHED_DAILY_G[d] ?? 0;
}

// Estimate today's feed for a shed in kg/day
export function estimateShedFeedKgToday(ageDays: number, liveBirds: number): number {
  const gPerBird = rossDailyIntakeG(ageDays);
  const birds = Math.max(0, Math.floor(liveBirds || 0));
  return (gPerBird * birds) / 1000; // grams -> kg
}
