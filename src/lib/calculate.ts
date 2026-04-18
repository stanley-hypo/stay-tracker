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

      // Calculate overlap between [dep, ret] and [windowStart, windowEnd]
      const overlapStart = dep < windowStart ? windowStart : dep;
      const overlapEnd = ret > windowEnd ? windowEnd : ret;

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
