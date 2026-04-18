import { parseISO, differenceInDays, addDays, format } from "date-fns";

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

/**
 * Find the riskiest 365-day windows for a set of trips.
 *
 * Algorithm: days abroad only changes at trip boundaries (depart/return dates),
 * so we only need to check windows that start on each boundary date.
 * This makes it O(n²) where n = number of trips (usually very small).
 */
export function findRiskPeriods(trips: Trip[]): RiskPeriod[] {
  if (trips.length === 0) return [];

  // Collect all boundary dates
  const boundaries = new Set<string>();
  for (const trip of trips) {
    boundaries.add(trip.departDate);
    boundaries.add(trip.returnDate);
    // Also check day after return (when you're back)
    boundaries.add(format(addDays(parseISO(trip.returnDate), 1), "yyyy-MM-dd"));
  }

  const sortedBoundaries = Array.from(boundaries).sort();
  const results: RiskPeriod[] = [];

  for (const startStr of sortedBoundaries) {
    const windowStart = parseISO(startStr);
    const windowEnd = addDays(windowStart, 364); // 365 days inclusive

    let daysAbroad = 0;
    for (const trip of trips) {
      const dep = parseISO(trip.departDate);
      const ret = parseISO(trip.returnDate);

      // Abroad days = full days between depart and return (exclusive both ends)
      // Depart day & return day count as in HK, only intermediate days count as abroad
      const tripStart = addDays(dep, 1);  // first abroad day = day after depart
      const tripEnd = addDays(ret, -1);   // last abroad day = day before return

      // Calculate overlap between [tripStart, tripEnd] and [windowStart, windowEnd]
      const overlapStart = tripStart < windowStart ? windowStart : tripStart;
      const overlapEnd = tripEnd > windowEnd ? windowEnd : tripEnd;

      if (overlapStart <= overlapEnd) {
        daysAbroad += differenceInDays(overlapEnd, overlapStart) + 1;
      }
    }

    const daysLocal = 365 - daysAbroad;
    results.push({
      windowStart: startStr,
      windowEnd: format(windowEnd, "yyyy-MM-dd"),
      daysAbroad,
      daysLocal,
      passed: daysLocal >= 180,
    });
  }

  // Sort by daysAbroad descending (worst first), then by windowStart
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
    // Use the year of the window start
    const year = parseISO(period.windowStart).getFullYear();
    const existing = yearMap.get(year);
    if (!existing || period.daysAbroad > existing.daysAbroad) {
      yearMap.set(year, period);
    }
    // Also tag the year of the window end
    const endYear = parseISO(period.windowEnd).getFullYear();
    const existingEnd = yearMap.get(endYear);
    if (!existingEnd || period.daysAbroad > existingEnd.daysAbroad) {
      yearMap.set(endYear, period);
    }
  }

  return Array.from(yearMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, worst]) => ({ year, worst }));
}

export interface FutureWindow {
  /** Start of the 365-day window */
  windowStart: string;
  /** End of the 365-day window */
  windowEnd: string;
  /** Days abroad already committed in this window */
  daysAbroad: number;
  /** Days in local */
  daysLocal: number;
  /** How many more days can still be spent abroad (max 185 - daysAbroad) */
  remainingAbroad: number;
  /** Whether current status passes */
  passed: boolean;
}

/**
 * Get active 365-day windows that overlap with today,
 * showing how many days abroad are already committed and how many remain.
 *
 * Key insight: the most constrained window is NOT the one starting today.
 * It's the window that started in the past (up to 364 days ago) that
 * has already accumulated the most abroad days from past trips.
 *
 * Algorithm: check every boundary date from [today - 364, today],
 * plus today itself. Each boundary defines a 365-day window that
 * is currently "active" (overlaps today).
 */
export function getFutureWindows(trips: Trip[]): FutureWindow[] {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const earliestStart = addDays(today, -364); // window starting 364 days ago still ends today

  if (trips.length === 0) {
    return [{
      windowStart: todayStr,
      windowEnd: format(addDays(today, 364), "yyyy-MM-dd"),
      daysAbroad: 0,
      daysLocal: 365,
      remainingAbroad: 185,
      passed: true,
    }];
  }

  // Collect ALL boundary dates, then filter to only those that produce
  // windows overlapping today: start ∈ [today - 364, today]
  const boundaries = new Set<string>();
  boundaries.add(todayStr);

  for (const trip of trips) {
    boundaries.add(trip.departDate);
    boundaries.add(trip.returnDate);
    boundaries.add(format(addDays(parseISO(trip.returnDate), 1), "yyyy-MM-dd"));
  }

  const earliestStr = format(earliestStart, "yyyy-MM-dd");
  const sorted = Array.from(boundaries)
    .filter(d => d >= earliestStr && d <= todayStr)
    .sort();

  const windows: FutureWindow[] = [];

  for (const startStr of sorted) {
    const windowStart = parseISO(startStr);
    const windowEnd = addDays(windowStart, 364);

    let daysAbroad = 0;
    for (const trip of trips) {
      const dep = parseISO(trip.departDate);
      const ret = parseISO(trip.returnDate);
      // Abroad days = full days between depart and return (exclusive both ends)
      const tripStart = addDays(dep, 1);
      const tripEnd = addDays(ret, -1);
      const overlapStart = tripStart < windowStart ? windowStart : tripStart;
      const overlapEnd = tripEnd > windowEnd ? windowEnd : tripEnd;
      if (overlapStart <= overlapEnd) {
        daysAbroad += differenceInDays(overlapEnd, overlapStart) + 1;
      }
    }

    const daysLocal = 365 - daysAbroad;
    windows.push({
      windowStart: startStr,
      windowEnd: format(windowEnd, "yyyy-MM-dd"),
      daysAbroad,
      daysLocal,
      remainingAbroad: Math.max(0, 185 - daysAbroad),
      passed: daysLocal >= 180,
    });
  }

  // Sort by daysAbroad descending (most constrained first)
  windows.sort((a, b) => b.daysAbroad - a.daysAbroad || a.windowStart.localeCompare(b.windowStart));

  return windows;
}
