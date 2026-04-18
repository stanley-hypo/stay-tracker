import { parseISO, differenceInDays, eachYearOfInterval, startOfYear, endOfYear, isWithinInterval, format } from "date-fns";

export interface Trip {
  id: string;
  destination: string;
  departDate: string;
  returnDate: string;
}

export interface YearSummary {
  year: number;
  daysAbroad: number;
  daysLocal: number;
  passed: boolean;
  trips: Trip[];
}

export function calculateYearlySummary(trips: Trip[]): YearSummary[] {
  if (trips.length === 0) return [];

  // Find year range
  const allDates = trips.flatMap((t) => [parseISO(t.departDate), parseISO(t.returnDate)]);
  const minDate = allDates.reduce((a, b) => (a < b ? a : b));
  const maxDate = allDates.reduce((a, b) => (a > b ? a : b));

  const years = eachYearOfInterval({
    start: startOfYear(minDate),
    end: endOfYear(maxDate),
  }).map((d) => d.getFullYear());

  const thisYear = new Date().getFullYear();
  if (!years.includes(thisYear)) years.push(thisYear);
  years.sort((a, b) => b - a); // newest first

  return years.map((year) => {
    const yStart = startOfYear(new Date(year, 0, 1));
    const yEnd = endOfYear(new Date(year, 0, 1));
    const totalDaysInYear = differenceInDays(yEnd, yStart) + 1;

    let daysAbroad = 0;
    const yearTrips: Trip[] = [];

    for (const trip of trips) {
      const dep = parseISO(trip.departDate);
      const ret = parseISO(trip.returnDate);

      // Check if trip overlaps with this year
      const overlapStart = dep < yStart ? yStart : dep;
      const overlapEnd = ret > yEnd ? yEnd : ret;

      if (overlapStart <= overlapEnd) {
        const days = differenceInDays(overlapEnd, overlapStart) + 1;
        daysAbroad += days;
        yearTrips.push(trip);
      }
    }

    const daysLocal = totalDaysInYear - daysAbroad;
    return {
      year,
      daysAbroad,
      daysLocal,
      passed: daysLocal >= 180,
      trips: yearTrips,
    };
  });
}
