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

