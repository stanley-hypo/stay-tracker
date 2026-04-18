"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "確定",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-md w-full">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 transition cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition cursor-pointer ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ToastProps {
  message: string;
  type: "success" | "error";
}

export function Toast({ message, type }: ToastProps) {
  if (!message) return null;
  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white animate-slide-in ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      {type === "success" ? "✅" : "❌"} {message}
    </div>
  );
}

// --- Client-side action wrappers with validation ---

export function useUserActions() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function addUser(formData: FormData) {
    const name = (formData.get("name") as string)?.trim();
    if (!name || name.length < 1) {
      alert("請輸入用戶名稱");
      return;
    }
    if (name.length > 100) {
      alert("用戶名稱不能超過 100 個字");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/users", {
        method: "POST",
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "新增失敗");
        return;
      }
      router.refresh();
    });
  }

  function deleteUser(userId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "刪除失敗");
        return;
      }
      router.refresh();
      router.push("/");
    });
  }

  return { addUser, deleteUser, isPending };
}

export function useTripActions() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function addTrip(formData: FormData) {
    const userId = formData.get("userId") as string;
    const destination = (formData.get("destination") as string)?.trim();
    const departDate = formData.get("departDate") as string;
    const returnDate = formData.get("returnDate") as string;

    if (!userId) {
      alert("請選擇用戶");
      return;
    }
    if (!destination || destination.length < 1) {
      alert("請輸入目的地");
      return;
    }
    if (destination.length > 200) {
      alert("目的地不能超過 200 個字");
      return;
    }
    if (!departDate || !returnDate) {
      alert("請選擇出發及回程日期");
      return;
    }
    if (new Date(returnDate) < new Date(departDate)) {
      alert("回程日期不能早於出發日期");
      return;
    }
    const diff =
      (new Date(returnDate).getTime() - new Date(departDate).getTime()) /
      (1000 * 60 * 60 * 24);
    if (diff + 1 > 365) {
      alert("單次出國不能超過 365 日，請分開記錄");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/trips", {
        method: "POST",
        body: JSON.stringify({ userId, destination, departDate, returnDate }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "新增失敗");
        return;
      }
      router.refresh();
    });
  }

  function deleteTrip(tripId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "刪除失敗");
        return;
      }
      router.refresh();
    });
  }

  return { addTrip, deleteTrip, isPending };
}
