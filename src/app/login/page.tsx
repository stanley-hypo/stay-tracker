"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (res.ok) {
        window.location.href = "/";
      } else {
        setError(data.error || "密碼錯誤");
      }
    } catch {
      setError("登入失敗，請重試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="bg-white rounded-2xl shadow-lg border p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold">📅 Stay Tracker</h1>
            <p className="text-gray-500 text-sm mt-2">請輸入密碼以繼續</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密碼"
              autoFocus
              className="w-full border rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-indigo-600 text-white rounded-lg py-3 font-medium hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? "驗證中..." : "登入"}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 text-xs mt-4">
          居留日數計算器 · 私人工具
        </p>
      </div>
    </div>
  );
}
