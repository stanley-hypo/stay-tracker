"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal, Toast } from "./ui";
import type { RiskPeriod } from "@/lib/calculate";

interface User {
  id: string;
  name: string;
  note: string | null;
}

interface Trip {
  id: string;
  userId: string;
  destination: string;
  departDate: string;
  returnDate: string;
}

interface FutureWindow {
  windowStart: string;
  windowEnd: string;
  daysAbroad: number;
  daysLocal: number;
  remainingAbroad: number;
  passed: boolean;
}

interface Props {
  allUsers: User[];
  selectedUserId: string;
  userTrips: Trip[];
  worstPerYear: { year: number; worst: RiskPeriod }[];
  topRisks: RiskPeriod[];
  futureWindows: FutureWindow[];
}

export function HomeClient({
  allUsers,
  selectedUserId,
  userTrips,
  worstPerYear,
  topRisks,
  futureWindows,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modal, setModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    danger: boolean;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", danger: false, onConfirm: () => {} });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function confirm(title: string, message: string, danger: boolean, onConfirm: () => void) {
    setModal({ open: true, title, message, danger, onConfirm });
  }

  // --- User actions ---
  function handleAddUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string)?.trim();
    if (!name) { showToast("請輸入用戶名稱", "error"); return; }
    if (name.length > 100) { showToast("用戶名稱不能超過 100 個字", "error"); return; }

    startTransition(async () => {
      const res = await fetch("/api/users", {
        method: "POST",
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "新增失敗", "error"); return; }
      showToast(`已新增用戶「${name}」`, "success");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    });
  }

  function handleDeleteUser(user: User) {
    confirm(
      "刪除用戶",
      `確定要刪除「${user.name}」嗎？所有出國記錄都會一併刪除，此操作無法復原。`,
      true,
      () => {
        setModal((m) => ({ ...m, open: false }));
        startTransition(async () => {
          const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
          const data = await res.json();
          if (!res.ok) { showToast(data.error || "刪除失敗", "error"); return; }
          showToast(`已刪除用戶「${user.name}」`, "success");
          router.push("/");
          router.refresh();
        });
      }
    );
  }

  // --- Trip actions ---
  function handleAddTrip(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const userId = fd.get("userId") as string;
    const destination = (fd.get("destination") as string)?.trim();
    const departDate = fd.get("departDate") as string;
    const returnDate = fd.get("returnDate") as string;

    if (!destination) { showToast("請輸入目的地", "error"); return; }
    if (destination.length > 200) { showToast("目的地不能超過 200 個字", "error"); return; }
    if (!departDate || !returnDate) { showToast("請選擇出發及回程日期", "error"); return; }
    if (new Date(returnDate) < new Date(departDate)) { showToast("回程日期不能早於出發日期", "error"); return; }
    const diff = (new Date(returnDate).getTime() - new Date(departDate).getTime()) / (1000 * 60 * 60 * 24);
    if (diff + 1 > 365) { showToast("單次出國不能超過 365 日", "error"); return; }

    startTransition(async () => {
      const res = await fetch("/api/trips", {
        method: "POST",
        body: JSON.stringify({ userId, destination, departDate, returnDate }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "新增失敗", "error"); return; }
      showToast("已新增出國記錄", "success");
      (e.target as HTMLFormElement).reset();
      // Re-set hidden userId
      const hiddenInput = (e.target as HTMLFormElement).querySelector('input[name="userId"]') as HTMLInputElement;
      if (hiddenInput) hiddenInput.value = userId;
      router.refresh();
    });
  }

  function handleDeleteTrip(trip: Trip) {
    confirm(
      "刪除出國記錄",
      `確定要刪除「${trip.destination}」（${trip.departDate} → ${trip.returnDate}）嗎？`,
      true,
      () => {
        setModal((m) => ({ ...m, open: false }));
        startTransition(async () => {
          const res = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
          const data = await res.json();
          if (!res.ok) { showToast(data.error || "刪除失敗", "error"); return; }
          showToast("已刪除記錄", "success");
          router.refresh();
        });
      }
    );
  }

  const selectedUser = allUsers.find((u) => u.id === selectedUserId);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-2">📅 Stay Tracker</h1>
      <p className="text-center text-gray-500 mb-8">
        計算任何連續 365 日內是否在本地停留 ≥ 180 日
      </p>

      <ConfirmModal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        danger={modal.danger}
        onConfirm={modal.onConfirm}
        onCancel={() => setModal((m) => ({ ...m, open: false }))}
      />
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* User Management */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">👤 用戶管理</h2>
        <form onSubmit={handleAddUser} className="flex gap-2 mb-4">
          <input
            name="name"
            placeholder="用戶名稱"
            required
            disabled={isPending}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
          >
            {isPending ? "..." : "＋ 新增"}
          </button>
        </form>

        {allUsers.length > 0 ? (
          <div className="space-y-2">
            {allUsers.map((user) => (
              <div
                key={user.id}
                className={`flex items-center justify-between rounded-lg px-4 py-2.5 transition ${
                  selectedUserId === user.id
                    ? "bg-blue-50 border-2 border-blue-400"
                    : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                }`}
              >
                <a
                  href={`?user=${user.id}`}
                  className={`flex-1 font-medium ${
                    selectedUserId === user.id
                      ? "text-blue-700"
                      : "text-gray-700 hover:text-blue-600"
                  }`}
                >
                  {user.name}
                  {selectedUserId === user.id && " ◀"}
                </a>
                <button
                  onClick={() => handleDeleteUser(user)}
                  disabled={isPending}
                  className="text-red-400 hover:text-red-600 text-sm cursor-pointer ml-2 disabled:opacity-50"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-4">請先新增用戶</p>
        )}
      </div>

      {/* Selected User Content */}
      {selectedUser && (
        <>
          {/* Add Trip Form */}
          <form onSubmit={handleAddTrip} className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              ✈️ 新增出國記錄 — {selectedUser.name}
            </h2>
            <input type="hidden" name="userId" value={selectedUserId} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <input
                name="destination"
                placeholder="目的地"
                required
                disabled={isPending}
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
              />
              <input
                name="departDate"
                type="date"
                required
                disabled={isPending}
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
              />
              <input
                name="returnDate"
                type="date"
                required
                disabled={isPending}
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
            >
              {isPending ? "處理中..." : "＋ 新增"}
            </button>
          </form>

          {/* Active Windows — Planning */}
          {futureWindows.length > 0 && (() => {
            // futureWindows is sorted by daysAbroad desc (most constrained first)
            const tightestWin = futureWindows[0];
            const relaxedWin = futureWindows.reduce((best, w) =>
              w.remainingAbroad > best.remainingAbroad ? w : best, futureWindows[0]);
            const isSame = tightestWin.windowStart === relaxedWin.windowStart;

            return (
              <div className="space-y-4 mb-6">
                <h2 className="text-lg font-semibold">🔮 離港預算（進行中嘅 365 日窗口）</h2>

                {/* Tightest Window */}
                <div className={`rounded-xl shadow-sm border p-5 ${
                  tightestWin.passed
                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
                    : "bg-gradient-to-r from-red-50 to-orange-50 border-red-200"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`font-semibold ${tightestWin.passed ? "text-blue-700" : "text-red-700"}`}>
                      🔴 最緊窗口
                    </h3>
                    <StatusBadge passed={tightestWin.passed} />
                  </div>
                  <ProgressBar daysLocal={tightestWin.daysLocal} />
                  <div className="flex flex-wrap justify-between gap-2 text-sm mt-2">
                    <span className="text-gray-600">🏠 在港 {tightestWin.daysLocal} 日</span>
                    <span className="text-gray-600">✈️ 已離港 {tightestWin.daysAbroad} 日</span>
                    <span className={`font-semibold ${tightestWin.remainingAbroad > 30 ? "text-blue-600" : tightestWin.remainingAbroad > 0 ? "text-amber-600" : "text-red-600"}`}>
                      🎒 尚可離港 {tightestWin.remainingAbroad} 日
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {tightestWin.windowStart} → {tightestWin.windowEnd}
                  </p>
                </div>

                {/* Most Relaxed Window */}
                {!isSame && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl shadow-sm border border-green-200 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-green-700">🏆 最寬鬆窗口</h3>
                      <span className="text-sm text-green-600 font-semibold">
                        尚可離港 {relaxedWin.remainingAbroad} 日
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {relaxedWin.windowStart} → {relaxedWin.windowEnd}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      呢個進行中嘅窗口有最多離港 budget
                    </p>
                  </div>
                )}

                {/* All Active Windows */}
                {futureWindows.length > 1 && (
                  <details className="bg-white rounded-xl shadow-sm border">
                    <summary className="p-4 cursor-pointer font-medium text-sm text-gray-700 hover:bg-gray-50 rounded-xl">
                      📋 查看所有進行中窗口（{futureWindows.length} 個，由最緊到最鬆）
                    </summary>
                    <div className="px-4 pb-4 space-y-2">
                      {futureWindows.map((w, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                            i === 0
                              ? "bg-red-50 border border-red-200"
                              : w.windowStart === relaxedWin.windowStart
                                ? "bg-green-50 border border-green-200"
                                : "bg-gray-50"
                          }`}
                        >
                          <span className="text-gray-700">
                            {w.windowStart} → {w.windowEnd}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500">✈️ 已用 {w.daysAbroad}日</span>
                            <span className={`font-semibold ${w.remainingAbroad > 30 ? "text-blue-600" : w.remainingAbroad > 0 ? "text-amber-600" : "text-red-600"}`}>
                              🎒 可用 {w.remainingAbroad}日
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })()}

          {/* Failing Years Only */}
          {worstPerYear.length > 0 && (
            <div className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">⚠️ 不合格年份（任何 365 日）</h2>
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
              <h2 className="text-lg font-semibold mb-4">⚠️ 高風險期間</h2>
              <div className="space-y-2">
                {topRisks.map((r, i) => (
                  <div
                    key={`${r.windowStart}-${i}`}
                    className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                      r.passed ? "bg-green-50" : "bg-red-50"
                    }`}
                  >
                    <span className="font-medium text-sm">
                      {r.windowStart} → {r.windowEnd}
                    </span>
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
                        ({dayDiff(trip.returnDate, trip.departDate)}日)
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteTrip(trip)}
                      disabled={isPending}
                      className="text-red-400 hover:text-red-600 text-sm cursor-pointer disabled:opacity-50"
                    >
                      🗑️
                    </button>
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
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function dayDiff(end: string, start: string): number {
  // Count only intermediate days (exclude depart & return)
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) - 1;
}
