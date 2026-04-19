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

interface ActiveWindow {
  windowStart: string;
  windowEnd: string;
  daysAbroad: number;
  daysLocal: number;
  remainingAbroad: number;
  passed: boolean;
}

interface PlanningMonth {
  date: string;
  label: string;
  committedDays: number;
  remainingBudget: number;
  passed: boolean;
}

interface PlanningResult {
  departDate: string;
  latestSafeReturn: string;
  tripDays: number;
  abroadNights: number;
  committedDays: number;
  worstWindow: string;
  worstWindowAbroad: number;
  headroom: number;
  milestones: { label: string; returnDate: string; daysAbroad: number; remaining: number; safe: boolean }[];
}

interface Props {
  allUsers: User[];
  selectedUserId: string;
  userTrips: Trip[];
  worstPerYear: { year: number; worst: RiskPeriod }[];
  topRisks: RiskPeriod[];
  activeWindows: ActiveWindow[];
  planningTimeline: PlanningMonth[];
}

export function HomeClient({
  allUsers,
  selectedUserId,
  userTrips,
  worstPerYear,
  topRisks,
  activeWindows,
  planningTimeline,
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
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [editForm, setEditForm] = useState({ destination: "", departDate: "", returnDate: "" });

  // --- Planner state ---
  const [plannerDepart, setPlannerDepart] = useState("");
  const [planningResult, setPlanningResult] = useState<PlanningResult | null>(null);
  const [planningLoading, setPlanningLoading] = useState(false);

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

  // --- Edit trip ---
  function openEditTrip(trip: Trip) {
    setEditingTrip(trip);
    setEditForm({ destination: trip.destination, departDate: trip.departDate, returnDate: trip.returnDate });
  }

  function handleEditTrip(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingTrip) return;
    const dest = editForm.destination.trim();
    if (!dest) { showToast("請輸入目的地", "error"); return; }
    if (dest.length > 200) { showToast("目的地不能超過 200 個字", "error"); return; }
    if (!editForm.departDate || !editForm.returnDate) { showToast("請選擇出發及回程日期", "error"); return; }
    if (new Date(editForm.returnDate) < new Date(editForm.departDate)) { showToast("回程日期不能早於出發日期", "error"); return; }
    const diff = (new Date(editForm.returnDate).getTime() - new Date(editForm.departDate).getTime()) / (1000 * 60 * 60 * 24);
    if (diff + 1 > 365) { showToast("單次出國不能超過 365 日", "error"); return; }

    startTransition(async () => {
      const res = await fetch(`/api/trips/${editingTrip.id}`, {
        method: "PUT",
        body: JSON.stringify({ destination: dest, departDate: editForm.departDate, returnDate: editForm.returnDate }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "更新失敗", "error"); return; }
      showToast("已更新記錄", "success");
      setEditingTrip(null);
      router.refresh();
    });
  }

  // --- Planner ---
  function handlePlannerDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const date = e.target.value;
    setPlannerDepart(date);
    setPlanningResult(null);

    if (!date || !selectedUserId) return;
    setPlanningLoading(true);
    fetch(`/api/planning?userId=${selectedUserId}&departDate=${date}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { showToast(data.error, "error"); return; }
        setPlanningResult(data);
      })
      .catch(() => showToast("計算失敗", "error"))
      .finally(() => setPlanningLoading(false));
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

      {/* Edit Trip Modal */}
      {editingTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingTrip(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">✏️ 編輯出國記錄</h3>
            <form onSubmit={handleEditTrip} className="space-y-3">
              <input
                value={editForm.destination}
                onChange={e => setEditForm(f => ({ ...f, destination: e.target.value }))}
                placeholder="目的地"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">出發日期</label>
                  <input
                    type="date"
                    value={editForm.departDate}
                    onChange={e => setEditForm(f => ({ ...f, departDate: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">回程日期</label>
                  <input
                    type="date"
                    value={editForm.returnDate}
                    onChange={e => setEditForm(f => ({ ...f, returnDate: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTrip(null)}
                  className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "儲存中..." : "儲存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          {/* Interactive Planner */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-sm border border-indigo-200 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-1">🗓️ 出發規劃器</h2>
            <p className="text-sm text-gray-500 mb-4">選擇你想幾時出發，即時知道最長可以去幾耐</p>
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">📅 出發日期：</label>
              <input
                type="date"
                value={plannerDepart}
                onChange={handlePlannerDateChange}
                min={new Date().toISOString().split("T")[0]}
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none flex-1 max-w-xs"
              />
              {planningLoading && <span className="text-sm text-indigo-500 animate-pulse">計算中...</span>}
            </div>

            {planningResult && (
              <div className="space-y-3">
                {/* Hero result */}
                <div className={`rounded-xl p-5 ${planningResult.headroom === 0 ? "bg-amber-50 border-2 border-amber-300" : "bg-white border border-indigo-200"}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">如果你喺 {planningResult.departDate} 出發</p>
                      <p className="text-2xl font-bold text-indigo-700">最遲 {planningResult.latestSafeReturn} 返港</p>
                      <p className="text-sm text-gray-500 mt-1">
                        共 {planningResult.tripDays} 日（{planningResult.abroadNights} 晚）— {planningResult.headroom === 0 ? "⚠️ 用盡所有預算" : `仲有 ${planningResult.headroom} 日 buffer`}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-semibold ${planningResult.headroom === 0 ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"}`}>
                      {planningResult.headroom === 0 ? "⚠️ 零 buffer" : "✅ 安全"}
                    </div>
                  </div>

                  {/* Milestone bar */}
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-500 font-medium">常用行程長度：</p>
                    {planningResult.milestones.map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-12">{m.label}</span>
                        <span className="text-xs text-gray-400 w-24">{m.returnDate} 回</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all ${m.safe ? "bg-green-400" : "bg-red-400"}`}
                            style={{ width: `${Math.min((m.daysAbroad / 180) * 100, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold w-20 text-right ${m.safe ? "text-green-600" : "text-red-600"}`}>
                          {m.daysAbroad}/180 {m.safe ? "✅" : "❌"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Worst window info */}
                  <p className="text-xs text-gray-400 mt-3">
                    最緊窗口：{planningResult.worstWindow}（{planningResult.worstWindowAbroad}/180 日離港）
                  </p>
                </div>
              </div>
            )}

            {!planningResult && !planningLoading && (
              <p className="text-sm text-gray-400 text-center py-4">選擇出發日期查看規劃</p>
            )}
          </div>

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

          {/* Active Windows + Planning Timeline */}
          {activeWindows.length > 0 && (() => {
            const tightest = activeWindows[0];

            return (
              <div className="space-y-4 mb-6">
                {/* Tightest Active Window */}
                <div className={`rounded-xl shadow-sm border p-5 ${
                  tightest.passed
                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
                    : "bg-gradient-to-r from-red-50 to-orange-50 border-red-200"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`font-semibold ${tightest.passed ? "text-blue-700" : "text-red-700"}`}>
                      🔴 目前最緊窗口
                    </h3>
                    <StatusBadge passed={tightest.passed} />
                  </div>
                  <ProgressBar daysLocal={tightest.daysLocal} />
                  <div className="flex flex-wrap justify-between gap-2 text-sm mt-2">
                    <span className="text-gray-600">🏠 在港 {tightest.daysLocal} 日</span>
                    <span className="text-gray-600">✈️ 已離港 {tightest.daysAbroad} 日</span>
                    <span className={`font-semibold ${tightest.remainingAbroad > 30 ? "text-blue-600" : tightest.remainingAbroad > 0 ? "text-amber-600" : "text-red-600"}`}>
                      🎒 尚可離港 {tightest.remainingAbroad} 日
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {tightest.windowStart} → {tightest.windowEnd}
                  </p>
                </div>

                {/* All Active Windows */}
                {activeWindows.length > 1 && (
                  <details className="bg-white rounded-xl shadow-sm border">
                    <summary className="p-4 cursor-pointer font-medium text-sm text-gray-700 hover:bg-gray-50 rounded-xl">
                      📋 所有進行中窗口（{activeWindows.length} 個，由最緊到最鬆）
                    </summary>
                    <div className="px-4 pb-4 space-y-2">
                      {activeWindows.map((w, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                            i === 0 ? "bg-red-50 border border-red-200"
                              : i === activeWindows.length - 1 ? "bg-green-50 border border-green-200"
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

                {/* Planning Timeline — Future Months */}
                <h2 className="text-lg font-semibold pt-2">🔮 未來出發預算</h2>
                <p className="text-sm text-gray-500">
                  考慮晒所有已記錄嘅行程，如果你喺呢個月出發，最緊嗰個窗口仲有幾多日 budget
                </p>
                <div className="space-y-2">
                  {planningTimeline.map((m, i) => {
                    const budgetColor = m.remainingBudget > 30
                      ? "text-blue-600" : m.remainingBudget > 0
                      ? "text-amber-600" : "text-red-600";
                    const bgClass = m.passed
                      ? (m.remainingBudget > 100 ? "bg-blue-50" : "bg-amber-50")
                      : "bg-red-50";
                    const barPct = Math.min((m.remainingBudget / 180) * 100, 100);
                    const barColor = m.remainingBudget > 30
                      ? "bg-blue-400" : m.remainingBudget > 0
                      ? "bg-amber-400" : "bg-red-500";

                    return (
                      <div key={i} className={`rounded-lg border px-4 py-3 ${bgClass}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-medium text-sm">{m.label}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">✈️ 已 commit {m.committedDays} 日</span>
                            <span className={`font-semibold text-sm ${budgetColor}`}>
                              🎒 可用 {m.remainingBudget} 日
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full ${barColor} transition-all duration-300`} style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditTrip(trip)}
                        disabled={isPending}
                        className="text-blue-400 hover:text-blue-600 text-sm cursor-pointer disabled:opacity-50"
                        title="編輯"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteTrip(trip)}
                        disabled={isPending}
                        className="text-red-400 hover:text-red-600 text-sm cursor-pointer disabled:opacity-50"
                        title="刪除"
                      >
                        🗑️
                      </button>
                    </div>
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
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) - 1;
}
