-- ============================================================
-- SmartStock AI — Phase 2 Migration
-- Run AFTER schema.sql has already been applied.
-- Safe to run multiple times (idempotent).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECTION 1.1 — NEW TABLES
-- ────────────────────────────────────────────────────────────

-- 1. bill_scans
create table if not exists public.bill_scans (
  id               uuid        primary key default gen_random_uuid(),
  shop_id          uuid        not null references public.shops (id) on delete cascade,
  user_id          uuid        not null references auth.users (id) on delete cascade,
  storage_path     text        not null,
  processing_status text       not null default 'pending'
                               check (processing_status in ('pending','completed','failed')),
  extracted_items  jsonb,
  created_at       timestamptz not null default now()
);

-- 2. voice_logs
create table if not exists public.voice_logs (
  id              uuid        primary key default gen_random_uuid(),
  shop_id         uuid        not null references public.shops (id) on delete cascade,
  user_id         uuid        not null references auth.users (id) on delete cascade,
  raw_transcript  text        not null,
  parsed_intent   jsonb,
  action_taken    text,
  created_at      timestamptz not null default now()
);

-- 3. ai_predictions
create table if not exists public.ai_predictions (
  id              uuid        primary key default gen_random_uuid(),
  shop_id         uuid        not null references public.shops (id) on delete cascade,
  product_id      uuid        references public.products (id) on delete cascade,
  prediction_type text        not null check (prediction_type in ('demand','dead_stock','seasonal')),
  payload         jsonb       not null default '{}',
  ignored         boolean     not null default false,
  created_at      timestamptz not null default now()
);

-- 4. chat_history
create table if not exists public.chat_history (
  id         uuid        primary key default gen_random_uuid(),
  shop_id    uuid        not null references public.shops (id) on delete cascade,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  role       text        not null check (role in ('user','assistant')),
  message    text        not null,
  created_at timestamptz not null default now()
);

-- 5. purchase_orders
create table if not exists public.purchase_orders (
  id           uuid        primary key default gen_random_uuid(),
  shop_id      uuid        not null references public.shops (id) on delete cascade,
  supplier_id  uuid        references public.suppliers (id) on delete set null,
  order_number text        not null,
  status       text        not null default 'draft'
                           check (status in ('draft','sent','received')),
  total_value  numeric(12,2) not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (shop_id, order_number)
);

-- 6. purchase_order_items
create table if not exists public.purchase_order_items (
  id                  uuid        primary key default gen_random_uuid(),
  purchase_order_id   uuid        not null references public.purchase_orders (id) on delete cascade,
  product_id          uuid        not null references public.products (id) on delete cascade,
  quantity            integer     not null check (quantity >= 1),
  unit_cost           numeric(12,2) not null default 0,
  line_total          numeric(12,2) generated always as (quantity * unit_cost) stored
);

-- 7. feedback
create table if not exists public.feedback (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users (id) on delete set null,
  type        text        not null check (type in ('contact','feature_request','bug','general','complaint')),
  rating      integer     check (rating between 1 and 5),
  description text,
  email       text,
  name        text,
  created_at  timestamptz not null default now()
);

-- 8. bug_reports
create table if not exists public.bug_reports (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references auth.users (id) on delete set null,
  description    text        not null,
  screenshot_url text,
  status         text        not null default 'open'
                             check (status in ('open','in_review','resolved')),
  created_at     timestamptz not null default now()
);

-- 9. cookie_consents
create table if not exists public.cookie_consents (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        references auth.users (id) on delete cascade,
  anonymous_id  text,
  consent_given boolean     not null,
  accepted_at   timestamptz,
  declined_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- 10. shop_settings
create table if not exists public.shop_settings (
  shop_id                   uuid    primary key references public.shops (id) on delete cascade,
  language                  text    not null default 'en',
  theme                     text    not null default 'system',
  notify_low_stock          boolean not null default true,
  notify_out_of_stock       boolean not null default true,
  notify_expiry             boolean not null default true,
  notify_ai_recommendation  boolean not null default true,
  notify_purchase_order     boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);


-- ────────────────────────────────────────────────────────────
-- SECTION 1.2 — COLUMN ADDITIONS TO products
-- ────────────────────────────────────────────────────────────

alter table public.products
  add column if not exists tags              text[]  not null default '{}',
  add column if not exists search_keywords   text[]  not null default '{}',
  add column if not exists default_supplier_id uuid  references public.suppliers (id) on delete set null;


-- ────────────────────────────────────────────────────────────
-- SECTION 1.3 — UPDATE notifications TYPE CHECK CONSTRAINT
-- ────────────────────────────────────────────────────────────

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('low_stock','out_of_stock','expiry','ai_recommendation','purchase_order','system'));


-- ────────────────────────────────────────────────────────────
-- SECTION 1.4 — ROW LEVEL SECURITY FOR NEW TABLES
-- ────────────────────────────────────────────────────────────

-- Enable RLS on all new tables
alter table public.bill_scans          enable row level security;
alter table public.voice_logs          enable row level security;
alter table public.ai_predictions      enable row level security;
alter table public.chat_history        enable row level security;
alter table public.purchase_orders     enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.feedback            enable row level security;
alter table public.bug_reports         enable row level security;
alter table public.cookie_consents     enable row level security;
alter table public.shop_settings       enable row level security;

-- ── bill_scans ───────────────────────────────────────────────
drop policy if exists "bill_scans_by_shop_owner" on public.bill_scans;
create policy "bill_scans_by_shop_owner" on public.bill_scans
for all to authenticated
using (
  exists (select 1 from public.shops s where s.id = bill_scans.shop_id and s.owner_id = auth.uid())
)
with check (
  exists (select 1 from public.shops s where s.id = bill_scans.shop_id and s.owner_id = auth.uid())
);

-- ── voice_logs ───────────────────────────────────────────────
drop policy if exists "voice_logs_by_shop_owner" on public.voice_logs;
create policy "voice_logs_by_shop_owner" on public.voice_logs
for all to authenticated
using (
  exists (select 1 from public.shops s where s.id = voice_logs.shop_id and s.owner_id = auth.uid())
)
with check (
  exists (select 1 from public.shops s where s.id = voice_logs.shop_id and s.owner_id = auth.uid())
);

-- ── ai_predictions ───────────────────────────────────────────
drop policy if exists "ai_predictions_by_shop_owner" on public.ai_predictions;
create policy "ai_predictions_by_shop_owner" on public.ai_predictions
for all to authenticated
using (
  exists (select 1 from public.shops s where s.id = ai_predictions.shop_id and s.owner_id = auth.uid())
)
with check (
  exists (select 1 from public.shops s where s.id = ai_predictions.shop_id and s.owner_id = auth.uid())
);

-- ── chat_history ─────────────────────────────────────────────
drop policy if exists "chat_history_by_shop_owner" on public.chat_history;
create policy "chat_history_by_shop_owner" on public.chat_history
for all to authenticated
using (
  exists (select 1 from public.shops s where s.id = chat_history.shop_id and s.owner_id = auth.uid())
)
with check (
  exists (select 1 from public.shops s where s.id = chat_history.shop_id and s.owner_id = auth.uid())
);

-- ── purchase_orders ──────────────────────────────────────────
drop policy if exists "purchase_orders_by_shop_owner" on public.purchase_orders;
create policy "purchase_orders_by_shop_owner" on public.purchase_orders
for all to authenticated
using (
  exists (select 1 from public.shops s where s.id = purchase_orders.shop_id and s.owner_id = auth.uid())
)
with check (
  exists (select 1 from public.shops s where s.id = purchase_orders.shop_id and s.owner_id = auth.uid())
);

-- ── purchase_order_items ─────────────────────────────────────
drop policy if exists "purchase_order_items_by_shop_owner" on public.purchase_order_items;
create policy "purchase_order_items_by_shop_owner" on public.purchase_order_items
for all to authenticated
using (
  exists (
    select 1
    from public.purchase_orders po
    join public.shops s on s.id = po.shop_id
    where po.id = purchase_order_items.purchase_order_id
      and s.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.purchase_orders po
    join public.shops s on s.id = po.shop_id
    where po.id = purchase_order_items.purchase_order_id
      and s.owner_id = auth.uid()
  )
);

-- ── shop_settings ────────────────────────────────────────────
drop policy if exists "shop_settings_by_shop_owner" on public.shop_settings;
create policy "shop_settings_by_shop_owner" on public.shop_settings
for all to authenticated
using (
  exists (select 1 from public.shops s where s.id = shop_settings.shop_id and s.owner_id = auth.uid())
)
with check (
  exists (select 1 from public.shops s where s.id = shop_settings.shop_id and s.owner_id = auth.uid())
);

-- ── feedback ─────────────────────────────────────────────────
-- Authenticated users can select/update their own rows.
-- Anyone (including unauthenticated) can insert.
drop policy if exists "feedback_select_own" on public.feedback;
create policy "feedback_select_own" on public.feedback
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "feedback_update_own" on public.feedback;
create policy "feedback_update_own" on public.feedback
for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "feedback_insert_public" on public.feedback;
create policy "feedback_insert_public" on public.feedback
for insert with check (true);

-- ── bug_reports ──────────────────────────────────────────────
-- Authenticated users can select/update their own rows.
-- Anyone (including unauthenticated) can insert.
drop policy if exists "bug_reports_select_own" on public.bug_reports;
create policy "bug_reports_select_own" on public.bug_reports
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "bug_reports_update_own" on public.bug_reports;
create policy "bug_reports_update_own" on public.bug_reports
for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "bug_reports_insert_public" on public.bug_reports;
create policy "bug_reports_insert_public" on public.bug_reports
for insert with check (true);

-- ── cookie_consents ──────────────────────────────────────────
-- Public insert (visitors before auth).
-- Authenticated users can select/update their own rows.
drop policy if exists "cookie_consents_insert_public" on public.cookie_consents;
create policy "cookie_consents_insert_public" on public.cookie_consents
for insert with check (true);

drop policy if exists "cookie_consents_select_own" on public.cookie_consents;
create policy "cookie_consents_select_own" on public.cookie_consents
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "cookie_consents_update_own" on public.cookie_consents;
create policy "cookie_consents_update_own" on public.cookie_consents
for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- SECTION 1.5 — updated_at TRIGGERS
-- (set_updated_at() is already defined in schema.sql)
-- ────────────────────────────────────────────────────────────

drop trigger if exists trg_purchase_orders_updated_at on public.purchase_orders;
create trigger trg_purchase_orders_updated_at
before update on public.purchase_orders
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_shop_settings_updated_at on public.shop_settings;
create trigger trg_shop_settings_updated_at
before update on public.shop_settings
for each row execute procedure public.set_updated_at();
