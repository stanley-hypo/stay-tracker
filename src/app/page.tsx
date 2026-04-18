import { db } from "@/db";
import { trips } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { calculateYearlySummary, type YearSummary } from "@/lib/calculate";

export const dynamic = "force-dynamic";

async function addTrip(formData: FormData) {
  "use server";
  const destination = formData.get("destination") as string;
  const departDate = formData.get("departDate") as string;
  const returnDate = formData.get("returnDate") as string;

  if (!destination || !departDate || !returnDate) return;

  await db.insert(trips).values({ destination, departDate, returnDate });
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
        passed
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800"
      }`}
    >
      {passed ? "✅ 合格" : "❌ 不合格"}
    </span>
  );
}

function ProgressBar({ daysLocal, total }: { daysLocal: number; total: number }) {
  const pct = Math.min((daysLocal / total) * 100, 100);
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

export default async function Home() {
  const allTrips = await db.select().from(trips).orderBy(trips.departDate);
  const summaries: YearSummary[] = calculateYearlySummary(allTrips);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-2">📅 Stay Tracker</h1>
      <p className="text-center text-gray-500 mb-8">
        計算每年是否在本地停留 ≥ 180 日
      </p>

      {/* Add Trip Form */}
      <form action={addTrip} className="bg-white rounded-xl shadow-sm border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">✈️ 新增出國記錄</h2>
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

      {/* Year Summaries */}
      {summaries.length > 0 ? (
        <div className="space-y-4 mb-8">
          {summaries.map((s) => (
            <div key={s.year} className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold">{s.year} 年</h3>
                <StatusBadge passed={s.passed} />
              </div>
              <ProgressBar daysLocal={s.daysLocal} total={s.daysLocal + s.daysAbroad} />
              <div className="flex justify-between text-sm text-gray-600 mt-2">
                <span>🏠 在港 {s.daysLocal} 日</span>
                <span>✈️ 離港 {s.daysAbroad} 日</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12">
          暫無記錄，請新增出國記錄開始計算
        </div>
      )}

      {/* Trip List */}
      {allTrips.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">📋 所有出國記錄</h2>
          <div className="space-y-2">
            {allTrips.map((trip) => (
              <div
                key={trip.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
              >
                <div>
                  <span className="font-medium">{trip.destination}</span>
                  <span className="text-gray-500 text-sm ml-2">
                    {trip.departDate} → {trip.returnDate}
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
    </div>
  );
}
