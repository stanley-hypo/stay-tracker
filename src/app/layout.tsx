import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stay Tracker — 居留日數計算器",
  description: "計算每年是否在香港停留超過180日",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body className="bg-gray-50 min-h-screen antialiased">{children}</body>
    </html>
  );
}
