# SmartStock AI

Production-ready SaaS starter for inventory, billing, analytics, and demand forecasting for local businesses.

## Prerequisites

- Node.js 20+
- A Supabase project (Auth + Postgres)

## Setup

1. Create the database schema:
   - Open Supabase SQL Editor
   - Run `supabase/schema.sql`

2. Configure auth providers in Supabase (optional for now):
   - Google OAuth
   - GitHub OAuth

3. Create frontend env file:
   - Copy `apps/web/.env.example` to `apps/web/.env.local`
   - Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Keep `VITE_API_URL=http://localhost:4000` for local development

4. Install dependencies (from repo root):
   - `npm install`

5. Run dev servers:
   - `npm run dev`
   - Web: http://localhost:5173
   - API: http://localhost:4000/health

## Structure

- `apps/web`: React + Vite + Tailwind dashboard UI
- `apps/api`: Express API (AI endpoints are stubs)
- `packages/shared`: Shared zod schemas/types
- `supabase`: SQL schema and policies

## Vercel deployment

This repo is now wired for a Vercel deployment with:

- the Vite frontend built from `apps/web`
- serverless API handlers exposed under `/api`
- SPA fallback routing for React Router

### Required Vercel environment variables

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL=/api` (optional, recommended only if you want to set it explicitly)

Backend:

- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Deploy notes

1. Import the repo into Vercel.
2. Keep the project root at the repository root.
3. Vercel will use `vercel.json` to build `apps/web/dist`.
4. API requests from the frontend will go to the same domain at `/api/...`.

### Local development

- Frontend runs on `http://localhost:5173`
- API runs on `http://localhost:4000`
- In production, the frontend automatically falls back to `/api`
