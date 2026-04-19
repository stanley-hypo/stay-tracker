import { db } from "@/db";
import { trips } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { parseISO, differenceInDays, addDays, format } from "date-fns";

function countAbroad(ws: Date, we: Date, tripList: { departDate: string; returnDate: string }[]) {
  let total = 0;
  for (const t of tripList) {
    const dep = addDays(parseISO(t.departDate), 1);
    const ret = addDays(parseISO(t.returnDate), -1);
    const os = dep < ws ? ws : dep;
    const oe = ret > we ? we : ret;
    if (os <= oe) total += differenceInDays(oe, os) + 1;
  }
  return total;
}

function maxAbroadInAllWindows(allTrips: { departDate: string; returnDate: string }[]) {
  const boundaries = new Set<string>();
  for (const t of allTrips) {
    boundaries.add(t.departDate);
    boundaries.add(t.returnDate);
    boundaries.add(format(addDays(parseISO(t.returnDate), 1), "yyyy-MM-dd"));
  }
  let maxAbroad = 0;
  let maxWinStart = "";
  for (const startStr of Array.from(boundaries).sort()) {
    const ws = parseISO(startStr);
    const we = addDays(ws, 364);
    const abroad = countAbroad(ws, we, allTrips);
    if (abroad > maxAbroad) { maxAbroad = abroad; maxWinStart = startStr; }
  }
  return { maxAbroad, maxWinStart };
}

// GET /api/planning?userId=xxx&departDate=2026-04-19
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const departDate = searchParams.get("departDate");

  if (!userId || !departDate) {
    return NextResponse.json({ error: "請提供 userId 同 departDate" }, { status: 400 });
  }

  const dep = new Date(departDate);
  if (isNaN(dep.getTime())) {
    return NextResponse.json({ error: "日期格式無效" }, { status: 400 });
  }

  // Get user's existing trips
  const userTrips = await db.select().from(trips).where(eq(trips.userId, userId)).orderBy(trips.departDate);

  // Current committed: max abroad in windows containing departDate
  const currentMax = maxAbroadInAllWindows(userTrips);
  // Filter to only windows that actually contain departDate
  const boundaries1 = new Set<string>();
  const earliest = format(addDays(dep, -364), "yyyy-MM-dd");
  for (const t of userTrips) {
    if (t.departDate >= earliest && t.departDate <= departDate) boundaries1.add(t.departDate);
    if (t.returnDate >= earliest && t.returnDate <= departDate) boundaries1.add(t.returnDate);
    const r1 = format(addDays(parseISO(t.returnDate), 1), "yyyy-MM-dd");
    if (r1 >= earliest && r1 <= departDate) boundaries1.add(r1);
  }
  boundaries1.add(earliest);
  boundaries1.add(departDate);

  let committedMax = 0;
  let committedWindow = "";
  for (const startStr of boundaries1) {
    const ws = parseISO(startStr);
    const we = addDays(ws, 364);
    const abroad = countAbroad(ws, we, userTrips);
    if (abroad > committedMax) { committedMax = abroad; committedWindow = startStr; }
  }

  // Binary search for latest safe return date
  let lo = 2, hi = 365;
  let bestSafe = departDate;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const retDate = format(addDays(dep, mid), "yyyy-MM-dd");
    const allTrips = [...userTrips.map(t => ({ departDate: t.departDate, returnDate: t.returnDate })), { departDate, returnDate: retDate }];
    const { maxAbroad } = maxAbroadInAllWindows(allTrips);

    if (maxAbroad <= 180) {
      bestSafe = retDate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // Verify and get the worst window with the best safe return
  const allTripsAtBest = [...userTrips.map(t => ({ departDate: t.departDate, returnDate: t.returnDate })), { departDate, returnDate: bestSafe }];
  const { maxAbroad: finalMax, maxWinStart } = maxAbroadInAllWindows(allTripsAtBest);

  // Also compute some milestone returns
  const milestones = [
    { label: "7日", days: 7 },
    { label: "14日", days: 14 },
    { label: "30日", days: 30 },
    { label: "60日", days: 60 },
    { label: "90日", days: 90 },
    { label: "120日", days: 120 },
    { label: "最長", days: differenceInDays(parseISO(bestSafe), dep) },
  ].filter(m => m.days > 0 && format(addDays(dep, m.days), "yyyy-MM-dd") <= bestSafe);

  const milestoneResults = milestones.map(m => {
    const retDate = format(addDays(dep, m.days), "yyyy-MM-dd");
    const allT = [...userTrips.map(t => ({ departDate: t.departDate, returnDate: t.returnDate })), { departDate, returnDate: retDate }];
    const { maxAbroad } = maxAbroadInAllWindows(allT);
    return { label: m.label, returnDate: retDate, daysAbroad: maxAbroad, remaining: 180 - maxAbroad, safe: maxAbroad <= 180 };
  });

  return NextResponse.json({
    departDate,
    latestSafeReturn: bestSafe,
    tripDays: differenceInDays(parseISO(bestSafe), dep) + 1,
    abroadNights: differenceInDays(parseISO(bestSafe), dep) - 1,
    committedDays: committedMax,
    worstWindow: `${maxWinStart} → ${format(addDays(parseISO(maxWinStart), 364), "yyyy-MM-dd")}`,
    worstWindowAbroad: finalMax,
    headroom: 180 - finalMax,
    milestones: milestoneResults,
  });
}
