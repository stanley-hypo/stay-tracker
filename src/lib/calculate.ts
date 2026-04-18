import { parseISO, differenceInDays, addDays, addMonths, startOfMonth, format } from "date-fns";

export interface Trip {
  id: string;
  userId: string;
  destination: string;
  departDate: string;
  returnDate: string;
}

export interface RiskPeriod {
  /** Start of the 365-day window */
  windowStart: string;
  /** End of the 365-day window */
  windowEnd: string;
  /** Days spent abroad in this window */
  daysAbroad: number;
  /** Days in local (365 - daysAbroad) */
  daysLocal: number;
  /** Whether local days >= 180 */
  passed: boolean;
}

/** Count abroad days from trips that fall within a given 365-day window [ws, we]. */
function countAbroadInWindow(trips: Trip[], ws: Date, we: Date): number {
  let daysAbroad = 0;
  for (const trip of trips) {
    const dep = addDays(parseISO(trip.departDate), 1);  // first abroad day
    const ret = addDays(parseISO(trip.returnDate), -1);  // last abroad day
    const os = dep < ws ? ws : dep;
    const oe = ret > we ? we : ret;
    if (os <= oe) daysAbroad += differenceInDays(oe, os) + 1;
  }
  return daysAbroad;
}

/**
 * Find the riskiest 365-day windows for a set of trips.
 *
 * Algorithm: days abroad only changes at trip boundaries (depart/return dates),
 * so we only need to check windows that start on each boundary date.
 * This makes it O(n²) where n = number of trips (usually very small).
 */
export function findRiskPeriods(trips: Trip[]): RiskPeriod[] {
  if (trips.length === 0) return [];

  const boundaries = new Set<string>();
  for (const trip of trips) {
    boundaries.add(trip.departDate);
    boundaries.add(trip.returnDate);
    boundaries.add(format(addDays(parseISO(trip.returnDate), 1), "yyyy-MM-dd"));
  }

  const sortedBoundaries = Array.from(boundaries).sort();
  const results: RiskPeriod[] = [];

  for (const startStr of sortedBoundaries) {
    const ws = parseISO(startStr);
    const we = addDays(ws, 364);
    const daysAbroad = countAbroadInWindow(trips, ws, we);
    const daysLocal = 365 - daysAbroad;
    results.push({
      windowStart: startStr,
      windowEnd: format(we, "yyyy-MM-dd"),
      daysAbroad,
      daysLocal,
      passed: daysLocal >= 180,
    });
  }

  results.sort((a, b) => b.daysAbroad - a.daysAbroad || a.windowStart.localeCompare(b.windowStart));
  return results;
}

/**
 * Get the worst (most days abroad) risk period for each calendar year.
 */
export function getWorstPerYear(trips: Trip[]): { year: number; worst: RiskPeriod }[] {
  const allPeriods = findRiskPeriods(trips);
  if (allPeriods.length === 0) return [];

  const yearMap = new Map<number, RiskPeriod>();
  for (const period of allPeriods) {
    for (const y of [parseISO(period.windowStart).getFullYear(), parseISO(period.windowEnd).getFullYear()]) {
      const existing = yearMap.get(y);
      if (!existing || period.daysAbroad > existing.daysAbroad) yearMap.set(y, period);
    }
  }

  return Array.from(yearMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, worst]) => ({ year, worst }));
}

export interface FutureWindow {
  windowStart: string;
  windowEnd: string;
  daysAbroad: number;
  daysLocal: number;
  remainingAbroad: number;
  passed: boolean;
}

/**
 * Get ALL active windows (overlapping today) showing committed abroad days.
 * These are the windows that constrain you RIGHT NOW.
 */
export function getActiveWindows(trips: Trip[]): FutureWindow[] {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const earliestStr = format(addDays(today, -364), "yyyy-MM-dd");

  if (trips.length === 0) {
    return [{
      windowStart: todayStr,
      windowEnd: format(addDays(today, 364), "yyyy-MM-dd"),
      daysAbroad: 0, daysLocal: 365, remainingAbroad: 185, passed: true,
    }];
  }

  const boundaries = new Set<string>();
  boundaries.add(todayStr);
  for (const trip of trips) {
    boundaries.add(trip.departDate);
    boundaries.add(trip.returnDate);
    boundaries.add(format(addDays(parseISO(trip.returnDate), 1), "yyyy-MM-dd"));
  }

  const sorted = Array.from(boundaries)
    .filter(d => d >= earliestStr && d <= todayStr)
    .sort();

  const windows: FutureWindow[] = [];
  for (const startStr of sorted) {
    const ws = parseISO(startStr);
    const we = addDays(ws, 364);
    const daysAbroad = countAbroadInWindow(trips, ws, we);
    const daysLocal = 365 - daysAbroad;
    windows.push({
      windowStart: startStr,
      windowEnd: format(we, "yyyy-MM-dd"),
      daysAbroad,
      daysLocal,
      remainingAbroad: Math.max(0, 185 - daysAbroad),
      passed: daysLocal >= 180,
    });
  }

  windows.sort((a, b) => b.daysAbroad - a.daysAbroad || a.windowStart.localeCompare(b.windowStart));
  return windows;
}

export interface PlanningMonth {
  /** Representative date (15th of month) */
  date: string;
  /** Human-readable month label */
  label: string;
  /** Maximum committed abroad days in the tightest window containing this date */
  committedDays: number;
  /** How many more days you can still go abroad (185 - committedDays) */
  remainingBudget: number;
  /** Whether it's safe (committedDays <= 185) */
  passed: boolean;
}

/**
 * For each future month, find the tightest 365-day window containing a trip
 * departing that month, considering ALL existing past commitments.
 *
 * This answers: "if I travel this month, how many days can I safely go?"
 *
 * Algorithm: for each month M (today → +12 months):
 *   1. Representative date = 15th of month
 *   2. Any window [start, start+364] containing this date has start ∈ [date-364, date]
 *   3. Committed abroad only changes at trip boundaries, so check all trip boundaries
 *      in [date-364, date] plus the endpoints
 *   4. Max committed across all such starts = worst constraint for that month
 */
export function getPlanningTimeline(trips: Trip[]): PlanningMonth[] {
  const today = new Date();
  const points: PlanningMonth[] = [];

  for (let m = 0; m <= 12; m++) {
    const monthStart = startOfMonth(addMonths(today, m));
    const repDate = addDays(monthStart, 14); // 15th as representative
    if (repDate < today && m > 0) continue;

    const dateStr = format(repDate, "yyyy-MM-dd");
    const earliestStr = format(addDays(repDate, -364), "yyyy-MM-dd");

    // Collect all possible window starts in [date-364, date]
    const starts = new Set<string>();
    starts.add(earliestStr);
    starts.add(dateStr);

    for (const trip of trips) {
      if (trip.departDate >= earliestStr && trip.departDate <= dateStr) starts.add(trip.departDate);
      if (trip.returnDate >= earliestStr && trip.returnDate <= dateStr) starts.add(trip.returnDate);
      const r1 = format(addDays(parseISO(trip.returnDate), 1), "yyyy-MM-dd");
      if (r1 >= earliestStr && r1 <= dateStr) starts.add(r1);
    }

    let maxCommitted = 0;
    for (const startStr of starts) {
      const ws = parseISO(startStr);
      const we = addDays(ws, 364);
      maxCommitted = Math.max(maxCommitted, countAbroadInWindow(trips, ws, we));
    }

    points.push({
      date: dateStr,
      label: format(repDate, "yyyy年M月"),
      committedDays: maxCommitted,
      remainingBudget: Math.max(0, 185 - maxCommitted),
      passed: maxCommitted <= 185,
    });
  }

  return points;
}
