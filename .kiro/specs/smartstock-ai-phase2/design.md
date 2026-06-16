# Technical Design Document — SmartStock AI Phase 2

## Overview

This document covers the technical design for Phase 2 features. Phase 1 (auth, shop management, products, inventory, billing, dashboard, settings) already exists. All new code must integrate cleanly into the existing monorepo without rebuilding existing modules.

**Monorepo structure:**
```
apps/web        — React + Vite + Tailwind (frontend)
apps/api        — Express.js (backend AI/OCR endpoints)
packages/shared — Shared Zod schemas
supabase/       — SQL schema + seed files
```

---

## 1. Database Schema Additions

Run as a new migration file: `supabase/phase2_migration.sql`

### New Tables

```sql
-- Bill scans (Feature 3)
create table if not exists public.bill_scans (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  storage_path     text not null,
  processing_status text not null default 'pending'
                   check (processing_status in ('pending','completed','failed')),
  extracted_items  jsonb,
  created_at       timestamptz not null default now()
);

-- Voice logs (Feature 4)
create table if not exists public.voice_logs (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  raw_transcript text not null,
  parsed_intent  jsonb,
  action_taken   text,
  created_at     timestamptz not null default now()
);

-- AI predictions (Features 7, 8, 9)
create table if not exists public.ai_predictions (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops(id) on delete cascade,
  product_id       uuid references public.products(id) on delete cascade,
  prediction_type  text not null check (prediction_type in ('demand','dead_stock','seasonal')),
  payload          jsonb not null default '{}',
  ignored          boolean not null default false,
  created_at       timestamptz not null default now()
);

-- Chat history (Feature 6)
create table if not exists public.chat_history (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  message    text not null,
  created_at timestamptz not null default now()
);

-- Purchase orders (Feature 13)
create table if not exists public.purchase_orders (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  supplier_id  uuid references public.suppliers(id) on delete set null,
  order_number text not null,
  status       text not null default 'draft' check (status in ('draft','sent','received')),
  total_value  numeric(12,2) not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (shop_id, order_number)
);

-- Purchase order items (Feature 13)
create table if not exists public.purchase_order_items (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete cascade,
  quantity          integer not null check (quantity >= 1),
  unit_cost         numeric(12,2) not null default 0,
  line_total        numeric(12,2) generated always as (quantity * unit_cost) stored
);

-- Feedback (Feature 15)
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  type        text not null check (type in ('contact','feature_request','bug','general','complaint')),
  rating      integer check (rating between 1 and 5),
  description text,
  email       text,
  name        text,
  created_at  timestamptz not null default now()
);

-- Bug reports (Feature 15)
create table if not exists public.bug_reports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  description    text not null,
  screenshot_url text,
  status         text not null default 'open' check (status in ('open','in_review','resolved')),
  created_at     timestamptz not null default now()
);

-- Cookie consents (Feature 16)
create table if not exists public.cookie_consents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  anonymous_id  text,
  consent_given boolean not null,
  accepted_at   timestamptz,
  declined_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- Shop settings (Feature 17)
create table if not exists public.shop_settings (
  shop_id                  uuid primary key references public.shops(id) on delete cascade,
  language                 text not null default 'en',
  theme                    text not null default 'system',
  notify_low_stock         boolean not null default true,
  notify_out_of_stock      boolean not null default true,
  notify_expiry            boolean not null default true,
  notify_ai_recommendation boolean not null default true,
  notify_purchase_order    boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
```

### Column Additions to Existing Tables

```sql
-- Products: AI metadata + supplier link (Features 5, 12)
alter table public.products
  add column if not exists tags              text[] default '{}',
  add column if not exists search_keywords   text[] default '{}',
  add column if not exists default_supplier_id uuid references public.suppliers(id) on delete set null;

-- Notifications: add purchase_order type (Feature 14)
-- Drop and recreate check constraint to add the new value
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('low_stock','out_of_stock','expiry','ai_recommendation','purchase_order','system'));
```

### RLS Policies for New Tables

All new tables follow the same pattern as Phase 1: users can only access rows belonging to their own shop or user_id.

```sql
-- Bill scans
alter table public.bill_scans enable row level security;
create policy "bill_scans_shop_owner" on public.bill_scans for all to authenticated
  using (exists (select 1 from public.shops s where s.id = bill_scans.shop_id and s.owner_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from public.shops s where s.id = bill_scans.shop_id and s.owner_id = auth.uid()));

-- Voice logs, chat history, ai_predictions: same shop-owner pattern
-- Purchase orders, purchase order items: same shop-owner pattern
-- Feedback, bug reports: user_id = auth.uid()
-- Cookie consents: user_id = auth.uid() or public insert
-- Shop settings: shop owner pattern
```

---

## 2. Backend API Design (`apps/api`)

### New Dependencies to Install

```json
{
  "@google/generative-ai": "^0.21.0",
  "tesseract.js": "^5.1.1",
  "multer": "^1.4.5-lts.1",
  "@supabase/supabase-js": "^2.49.1",
  "form-data": "^4.0.0"
}
```

Add to `apps/api/.env`:
```
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # service role for server-side operations
```

### File Structure

```
apps/api/src/
  server.ts              (existing — add router mounts)
  routes/
    bill.ts              POST /ai/bill-scan, GET /ai/bill-history
    voice.ts             POST /ai/voice-command
    product-ai.ts        POST /ai/product-metadata
    chat.ts              POST /ai/chat
    predictions.ts       POST /ai/predictions/:shopId
  services/
    gemini.ts            Gemini API client + prompt builders
    ocr.ts               Tesseract.js wrapper
    demand.ts            Demand prediction calculations
    deadstock.ts         Dead stock detection logic
    seasonal.ts          Seasonal forecaster with Indian calendar
  middleware/
    upload.ts            multer config for bill image uploads
```

### API Endpoints

#### `POST /ai/bill-scan`
- Accepts: `multipart/form-data` with `image` file + `shop_id` field
- Flow: upload to Supabase Storage → run Tesseract OCR → call Gemini to parse → return structured items
- Response: `{ scan_id, items: [{ name, quantity, cost_price, matched_product_id? }] }`

#### `POST /ai/bill-scan/confirm`
- Accepts: `{ scan_id, shop_id, items: [...], user_id }`
- Flow: upsert products → update inventory_logs → update bill_scan status = 'completed'

#### `POST /ai/voice-command`
- Accepts: `multipart/form-data` with `audio` (webm/ogg blob) + `shop_id`
- Flow: use Web Speech API transcript sent as text OR audio → Gemini intent parse
- Response: `{ transcript, intent: { action, product_name, quantity, cost_price?, selling_price? } }`

#### `POST /ai/product-metadata`
- Accepts: `{ product_name, shop_type }`
- Flow: Gemini prompt → return metadata
- Response: `{ sku, category, brand, tags, reorder_threshold, search_keywords }`

#### `POST /ai/chat`
- Accepts: `{ shop_id, user_id, message, history: [{role, message}] }`
- Flow: build context snapshot from Supabase → call Gemini with context + history → return response
- Response: `{ reply }`

#### `POST /ai/predictions/:shopId`
- Flow: compute demand predictions + dead stock + seasonal → upsert ai_predictions table
- Response: `{ demand: [...], dead_stock: [...], seasonal: [...] }`

### Gemini Prompt Patterns

**Bill OCR parsing:**
```
You are a bill parser for an Indian grocery store. Given this OCR text from a supplier invoice, 
extract all product line items. Return JSON array: [{name, quantity, cost_price}].
Only return valid JSON, no explanation. OCR text: {text}
```

**Voice intent parsing:**
```
You are an inventory assistant for an Indian shop. Parse this voice command (may be English, Hindi, or Hinglish).
Return JSON: {action: "add"|"remove"|"create", product_name, quantity, cost_price?, selling_price?}
Only return valid JSON. If unclear, return {action: "unknown"}.
Command: {transcript}
```

**Product metadata generation:**
```
You are a product catalog assistant for an Indian retail store.
Given product name "{name}", generate metadata for a {shop_type} shop.
Return JSON: {sku, category, brand, tags: string[], reorder_threshold, search_keywords: string[]}
SKU format: 3 uppercase letters + hyphen + 3 digits (e.g. MAG-001).
Only return valid JSON.
```

**Business assistant:**
```
You are an AI business assistant for SmartStock AI, helping an Indian shop owner.
Shop data snapshot: {context_json}
Answer the user's question using only this data. Be concise and practical.
If you cannot answer from the data, say so clearly.
Question: {user_message}
```

---

## 3. Frontend Architecture

### New Routes to Add to `router.tsx`

```tsx
// Inside /app children:
{ path: 'ai',            element: <AIToolsPage /> },      // replaces stub
{ path: 'ai/assistant',  element: <AIAssistantPage /> },
{ path: 'ai/bill-scan',  element: <BillScanPage /> },
{ path: 'ai/bill-scan/history', element: <BillHistoryPage /> },
{ path: 'ai/voice',      element: <VoiceAssistantPage /> },
{ path: 'suppliers',     element: <SuppliersPage /> },
{ path: 'purchase-orders',        element: <PurchaseOrdersPage /> },
{ path: 'purchase-orders/:id',    element: <PurchaseOrderDetailPage /> },
{ path: 'notifications',          element: <NotificationsPage /> },
{ path: 'feedback',               element: <FeedbackPage /> },

// Public routes (no auth):
{ path: '/privacy',  element: <PrivacyPolicyPage /> },
{ path: '/terms',    element: <TermsPage /> },
{ path: '/cookies',  element: <CookiePolicyPage /> },
```

### New Folder Structure

```
apps/web/src/
  views/
    ai/
      AIToolsPage.tsx          Hub page with links to sub-features
      AIAssistantPage.tsx      Chat interface
      BillScanPage.tsx         Upload + OCR + preview flow
      BillHistoryPage.tsx      Past bill scans
      VoiceAssistantPage.tsx   Mic button + transcript + history
    suppliers/
      SuppliersPage.tsx
      SupplierForm.tsx
      SupplierDetailPage.tsx
    purchase-orders/
      PurchaseOrdersPage.tsx
      PurchaseOrderForm.tsx
      PurchaseOrderDetailPage.tsx
    notifications/
      NotificationsPage.tsx
    feedback/
      FeedbackPage.tsx         Tabbed: Contact / Feedback / Bug Report
    legal/
      PrivacyPolicyPage.tsx
      TermsPage.tsx
      CookiePolicyPage.tsx
    dashboard/
      DashboardPage.tsx        (existing — add AI Insights + Demand panels)
  ui/
    common/
      CookieConsentBanner.tsx
      NotificationBell.tsx     Bell icon + unread badge + dropdown
      VoiceFab.tsx             Floating mic button
    ai/
      InsightsPanel.tsx        AI Insights + Action Center
      DemandPanel.tsx          Stock-out predictions
      DeadStockPanel.tsx
      SeasonalPanel.tsx
  lib/
    api.ts                     Typed fetch wrapper for apps/api endpoints
    i18n.ts                    Translation map (EN/HI strings)
    notifications.ts           useNotifications hook
```

### Updated AppLayout Sidebar Navigation

```
Dashboard
Products
Inventory
Billing
── AI ──
  AI Tools (hub)
  AI Assistant
  Scan Bill
  Voice
── Operations ──
  Suppliers
  Purchase Orders
── Account ──
  Notifications
  Settings
  Feedback / Help
```

### Key Component Designs

#### `NotificationBell` (top bar)
- Fetches unread count via React Query on mount + 60s polling
- Renders badge if count > 0
- Click opens a `<NotificationPanel>` dropdown (max 50 items)
- Each item click: marks read + navigates

#### `VoiceFab` (floating action button)
- Fixed position bottom-right in AppLayout
- Click → opens `VoiceModal`
- VoiceModal: starts `MediaRecorder`, shows waveform animation, auto-stops at 60s
- On stop: sends audio blob to `/ai/voice-command`
- Shows transcript + intent confirmation before executing

#### `InsightsPanel` (dashboard widget)
- Loads from `ai_predictions` table filtered by `ignored = false` and `created_at > now - 1hr`
- Renders up to 10 cards sorted by urgency
- Each card expandable to show Action Center buttons

#### `BillScanPage` — 3-step wizard
```
Step 1: Upload → drag-drop or file picker → shows preview image
Step 2: Processing → spinner while OCR+AI runs → shows extracted table
Step 3: Review → editable table rows (match/new badges) → Confirm button
```

#### `AIAssistantPage` — chat interface
```
- Messages list (scrollable, auto-scroll to bottom)
- Input box + Send button
- Loading indicator while waiting for Gemini response
- Error state with retry button
- Clear Chat button top-right
```

### i18n Design (`lib/i18n.ts`)

Lightweight translation map — no external library needed at this scale.

```ts
type Lang = 'en' | 'hi'

const translations: Record<string, Record<Lang, string>> = {
  'nav.dashboard':   { en: 'Dashboard',  hi: 'डैशबोर्ड' },
  'nav.products':    { en: 'Products',   hi: 'उत्पाद' },
  'nav.inventory':   { en: 'Inventory',  hi: 'इन्वेंटरी' },
  // ... all nav + common UI strings
}

// React context: LanguageProvider wraps app
// useTranslation() hook: t('nav.dashboard') → string
```

Language preference loaded from `shop_settings.language` on shop load, stored in a React context.

### Notification Triggering Strategy

Notifications are generated **client-side** immediately after mutations (no server-side triggers needed for MVP):

- After a sale is created: check if any sold product went below `reorder_threshold` → insert `low_stock` or `out_of_stock` notification
- After an inventory adjustment: same check
- After purchase order status changed to `received`: insert `purchase_order` notification
- Expiry check: run once on app load (daily cadence via localStorage timestamp)

This avoids needing database triggers or a background worker, keeping the architecture simple.

### Cookie Consent Flow

```
App mounts → CookieConsentBanner checks localStorage('cookie_consent')
→ if 'accepted' or 'declined': don't show banner
→ else: show banner with Accept / Decline buttons
→ on Accept: localStorage('cookie_consent') = 'accepted' + insert cookie_consents row
→ on Decline: localStorage('cookie_consent') = 'declined' + insert cookie_consents row
```

---

## 4. Demand Prediction Calculations (Frontend)

Predictions are computed on the **frontend** from data already fetched, avoiding extra API calls for MVP. When Gemini API key is set, calculations move to the API layer.

```ts
// For each product:
const salesLast30Days = saleItems.filter(
  item => item.product_id === p.id &&
  new Date(item.created_at) >= subDays(new Date(), 30)
)
const totalSold = salesLast30Days.reduce((s, i) => s + i.quantity, 0)
const avgDailyRate = totalSold / 30
const daysUntilStockout = avgDailyRate > 0 ? Math.floor(p.quantity / avgDailyRate) : null
const stockoutDate = daysUntilStockout != null
  ? addDays(new Date(), daysUntilStockout) : null
const reorderQty = Math.ceil(avgDailyRate * 30)
```

Dead stock: products where `totalSold === 0` and `p.quantity > 0`.

Seasonal: hardcoded calendar checked against today's date, returns applicable seasons within 21 days.

---

## 5. Supabase Storage Buckets

Create these in Supabase Dashboard → Storage:

| Bucket | Public | Max file size | Allowed MIME types |
|---|---|---|---|
| `bills` | No | 10 MB | image/jpeg, image/png, image/webp, application/pdf |
| `bug-reports` | No | 5 MB | image/jpeg, image/png |

Storage RLS: users can only read/write files under paths prefixed with their `user_id/`.

---

## 6. Shared Zod Schema Additions (`packages/shared/src/index.ts`)

```ts
// Purchase order
export const PurchaseOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity:   z.number().int().min(1),
  unit_cost:  z.number().nonnegative(),
})

export const PurchaseOrderCreateSchema = z.object({
  supplier_id: z.string().uuid().optional().nullable(),
  notes:       z.string().optional().nullable(),
  items:       z.array(PurchaseOrderItemSchema).min(1),
})

// Supplier
export const SupplierSchema = z.object({
  name:         z.string().min(2),
  contact_name: z.string().optional().nullable(),
  phone:        z.string().optional().nullable(),
  email:        z.string().email().optional().nullable().or(z.literal('')),
  address:      z.string().optional().nullable(),
  notes:        z.string().optional().nullable(),
})

// Feedback
export const ContactUsSchema = z.object({
  name:    z.string().min(2),
  email:   z.string().email(),
  message: z.string().min(1).max(2000),
})

export const FeedbackSchema = z.object({
  rating:       z.number().int().min(1).max(5),
  type:         z.enum(['feature_request','bug','general','complaint']),
  description:  z.string().min(1).max(2000),
})

export const BugReportSchema = z.object({
  description: z.string().min(1).max(2000),
})
```

---

## 7. Implementation Order (Tasks)

Tasks will be implemented in this order to minimize dependency conflicts:

1. **Database migration** — `supabase/phase2_migration.sql` (all new tables + column additions)
2. **API dependencies + env** — install packages, update `.env.example`
3. **Shared schemas** — add purchase order, feedback, bug report schemas
4. **Supplier Management** (Feature 12) — CRUD page, no AI dependency
5. **Purchase Orders** (Feature 13) — depends on suppliers
6. **Notification Center** (Feature 14) — bell + panel + client-side triggers
7. **AI Insights + Demand + Dead Stock + Seasonal panels** (Features 7–10) — add to dashboard
8. **AI Action Center** (Feature 11) — depends on purchase orders
9. **API: product metadata** endpoint (Feature 5 backend)
10. **Smart Product Creation** (Feature 5 frontend) — Quick Add modal
11. **API: chat** endpoint (Feature 6 backend)
12. **AI Business Assistant page** (Feature 6 frontend)
13. **API: bill scan** endpoint (Feature 3 backend)
14. **Bill Scanner page** (Feature 3 frontend)
15. **API: voice command** endpoint (Feature 4 backend)
16. **Voice Assistant** (Feature 4 frontend)
17. **Feedback System** (Feature 15)
18. **Legal Pages + Cookie Consent** (Feature 16)
19. **Settings Enhancements + i18n** (Feature 17)
20. **AppLayout updates** — sidebar nav, VoiceFab, NotificationBell

---

## 8. New npm Dependencies Summary

### `apps/web`
```json
"react-i18n-minimal": false,  // use custom i18n.ts, no extra dep needed
```
No new frontend dependencies required — all features use existing stack (React Query, Zod, Lucide, Tailwind).

### `apps/api`
```json
"@google/generative-ai": "^0.21.0",
"tesseract.js": "^5.1.1",
"multer": "^1.4.5-lts.1",
"@supabase/supabase-js": "^2.49.1"
```
```json
"@types/multer": "^1.4.12"  // devDependency
```
