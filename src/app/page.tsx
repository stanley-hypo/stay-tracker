import { db } from "@/db";
import { users } from "@/db/schema";
import { findRiskPeriods, getWorstPerYear, getFutureWindows } from "@/lib/calculate";
import type { Trip } from "@/lib/calculate";
import { HomeClient } from "@/components/home-client";
import { trips } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const params = await searchParams;
  const selectedUserId = params.user || "";

  const allUsers = await db.select().from(users).orderBy(users.name);
  const userTrips: Trip[] = selectedUserId
    ? await db
        .select()
        .from(trips)
        .where(eq(trips.userId, selectedUserId))
        .orderBy(trips.departDate)
    : [];

  const riskPeriods = findRiskPeriods(userTrips);
  const worstPerYear = getWorstPerYear(userTrips).filter(({ worst }) => !worst.passed);
  const topRisks = riskPeriods.filter(r => !r.passed).slice(0, 5);
  const futureWindows = getFutureWindows(userTrips);

  return (
    <HomeClient
      allUsers={allUsers}
      selectedUserId={selectedUserId}
      userTrips={userTrips}
      worstPerYear={worstPerYear}
      topRisks={topRisks}
      futureWindows={futureWindows}
    />
  );
}
