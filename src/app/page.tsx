import { db } from "@/db";
import { trips, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { findRiskPeriods, getWorstPerYear, type RiskPeriod } from "@/lib/calculate";

export const dynamic = "force-dynamic";

async function addUser(formData: FormData) {
  "use server";
  const name = formData.get("name") as string;
  if (!name) return;
  await db.insert(users).values({ name });
  revalidatePath("/");
}

async function deleteUser(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  if (!id) return;
  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/");
}

async function addTrip(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  const destination = formData.get("destination") as string;
  const departDate = formData.get("departDate") as string;
  const returnDate = formData.get("returnDate") as string;
  if (!userId || !destination || !departDate || !returnDate) return;
  await db.insert(trips).values({ userId, destination, departDate, returnDate });
  revalidatePath("/");
}

async function deleteTrip(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  if (!id) return;
  await db.delete(trips).where(eq(trips.id, id));
  revalidatePath("/");
}

function StatusBadge({ passed }: { passed: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
        passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {passed ? "✅ 合格" : "❌ 不合格"}
    </span>
  );
}

function ProgressBar({ daysLocal }: { daysLocal: number }) {
  const pct = Math.min((daysLocal / 365) * 100, 100);
  const color = daysLocal >= 180 ? "bg-green-500" : "bg-red-500";
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const params = await searchParams;
  const selectedUserId = params.user || "";

  const allUsers = await db.select().from(users).orderBy(users.name);
  const userTrips = selectedUserId
    ? await db.select().from(trips).where(eq(trips.userId, selectedUserId)).orderBy(trips.departDate)
    : [];

  const riskPeriods = findRiskPeriods(userTrips);
  const worstPerYear = getWorstPerYear(userTrips);
  // Show top 5 worst periods
  const topRisks = riskPeriods.slice(0, 5);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-2">📅 Stay Tracker</h1>
      <p className="text-center text-gray-500 mb-8">
        計算任何連續 365 日內是否在本地停留 ≥ 180 日
      </p>

      {/* User Management */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">👤 用戶管理</h2>

        {/* Add User */}
        <form action={addUser} className="flex gap-2 mb-4">
          <input
            name="name"
            placeholder="用戶名稱"
            required
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition cursor-pointer"
          >
            ＋ 新增
          </button>
        </form>

        {/* User List */}
        {allUsers.length > 0 ? (
          <div className="space-y-2">
            {allUsers.map((user) => (
              <div
                key={user.id}
                className={`flex items-center justify-between rounded-lg px-4 py-2.5 cursor-pointer transition ${
                  selectedUserId === user.id
                    ? "bg-blue-50 border-2 border-blue-400"
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <a
                  href={`?user=${user.id}`}
                  className="flex-1 font-medium text-blue-700 hover:text-blue-900"
                >
                  {user.name}
                </a>
                <form action={deleteUser}>
                  <input type="hidden" name="id" value={user.id} />
                  <button
                    type="submit"
                    className="text-red-400 hover:text-red-600 text-sm cursor-pointer ml-2"
                    onClick={(e) => {
                      if (!confirm(`確定刪除 ${user.name}？所有出國記錄都會一併刪除。`))
                        e.preventDefault();
                    }}
                  >
                    🗑️
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-4">請先新增用戶</p>
        )}
      </div>

      {/* Selected User Content */}
      {selectedUserId && allUsers.find((u) => u.id === selectedUserId) && (
        <>
          {/* Add Trip Form */}
          <form action={addTrip} className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              ✈️ 新增出國記錄 — {allUsers.find((u) => u.id === selectedUserId)?.name}
            </h2>
            <input type="hidden" name="userId" value={selectedUserId} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <input
                name="destination"
                placeholder="目的地"
                required
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                name="departDate"
                type="date"
                required
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                name="returnDate"
                type="date"
                required
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 transition cursor-pointer"
            >
              ＋ 新增
            </button>
          </form>

          {/* Worst Period Per Year */}
          {worstPerYear.length > 0 && (
            <div className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">📊 按年最高風險期間（任何 365 日）</h2>
              {worstPerYear.map(({ year, worst }) => (
                <div key={year} className="bg-white rounded-xl shadow-sm border p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold">{year} 年</h3>
                    <StatusBadge passed={worst.passed} />
                  </div>
                  <ProgressBar daysLocal={worst.daysLocal} />
                  <div className="flex justify-between text-sm text-gray-600 mt-2">
                    <span>🏠 在港 {worst.daysLocal} 日</span>
                    <span>✈️ 離港 {worst.daysAbroad} 日</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    最差期間：{worst.windowStart} → {worst.windowEnd}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Top 5 Riskiest Windows */}
          {topRisks.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">⚠️ 最高風險 5 個期間</h2>
              <div className="space-y-2">
                {topRisks.map((r, i) => (
                  <div
                    key={`${r.windowStart}-${i}`}
                    className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                      r.passed ? "bg-green-50" : "bg-red-50"
                    }`}
                  >
                    <div>
                      <span className="font-medium text-sm">
                        {r.windowStart} → {r.windowEnd}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">🏠 {r.daysLocal}日</span>
                      <span className="text-sm text-gray-600">✈️ {r.daysAbroad}日</span>
                      <StatusBadge passed={r.passed} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trip List */}
          {userTrips.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4">📋 所有出國記錄</h2>
              <div className="space-y-2">
                {userTrips.map((trip) => (
                  <div
                    key={trip.id}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                  >
                    <div>
                      <span className="font-medium">{trip.destination}</span>
                      <span className="text-gray-500 text-sm ml-2">
                        {trip.departDate} → {trip.returnDate}
                      </span>
                      <span className="text-gray-400 text-xs ml-2">
                        ({differenceInDaysDisplay(trip.returnDate, trip.departDate)}日)
                      </span>
                    </div>
                    <form action={deleteTrip}>
                      <input type="hidden" name="id" value={trip.id} />
                      <button
                        type="submit"
                        className="text-red-400 hover:text-red-600 text-sm cursor-pointer"
                      >
                        🗑️
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          )}

          {userTrips.length === 0 && (
            <div className="text-center text-gray-400 py-12">
              暫無記錄，請新增出國記錄開始計算
            </div>
          )}
        </>
      )}
    </div>
  );
}

function differenceInDaysDisplay(end: string, start: string): number {
  const diff =
    new Date(end).getTime() - new Date(start).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}
