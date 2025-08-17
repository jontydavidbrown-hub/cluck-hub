// src/lib/rossFeed.ts
// Ross 308 / 308 FF — As-Hatched “Daily Intake (g)” by age in days.
// Source: Aviagen, Ross 308/308 FF Broiler Performance Objectives (2022), As-Hatched table. 
// https://aviagen.com/assets/Tech_Center/Ross_Broiler/RossxRoss308-BroilerPerformanceObjectives2022-EN.pdf
export const ROSS308_AS_HATCHED_DAILY_G: number[] = [
  NaN, // index 0 unused
  12,16,20,24,27,31,35,39,44,48,52,57,62,67,72,77,83,88,94,100,105,111,117,122,
  128,134,139,145,150,156,161,166,171,176,180,185,189,193,197,201,204,207,211,213,
  216,219,221,223,225,227,229,230,231,233,233,234
];

// Utility: estimate shed feed for "today" (kg/day).
export function estimateShedFeedKgToday(ageDays: number, liveBirds: number) {
  const d = Math.max(1, Math.min(56, Math.floor(ageDays)));
  const gPerBird = ROSS308_AS_HATCHED_DAILY_G[d] ?? 0;
  return (gPerBird * Math.max(0, liveBirds)) / 1000;
}
