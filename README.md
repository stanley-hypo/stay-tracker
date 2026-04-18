# Stay Tracker 📅

計算每年是否在本地停留 ≥ 180 日。

## Tech Stack
- Next.js 15 + React 19
- Drizzle ORM + Neon DB (Serverless PostgreSQL)
- Tailwind CSS v4
- Vercel 部署

## Getting Started

```bash
bun install
bun run db:push   # push schema to Neon
bun run dev       # start dev server
```

## 環境變數
```
DATABASE_URL=postgresql://...@xxx.neon.tech/neondb?sslmode=require
```
