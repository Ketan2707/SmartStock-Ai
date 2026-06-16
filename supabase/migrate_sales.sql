-- Migration: add missing columns to existing sales table
-- Run this BEFORE seed.sql if you already had the old sales table

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS customer_name  text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS payment_method text not null default 'cash',
  ADD COLUMN IF NOT EXISTS status         text not null default 'paid',
  ADD COLUMN IF NOT EXISTS notes          text;

-- Also create sale_items if it doesn't exist yet
create table if not exists public.sale_items (
  id             uuid primary key default gen_random_uuid(),
  sale_id        uuid not null references public.sales (id) on delete cascade,
  product_id     uuid not null references public.products (id) on delete cascade,
  product_name   text not null,
  sku            text not null,
  quantity       integer not null,
  cost_price     numeric(12,2) not null,
  selling_price  numeric(12,2) not null,
  total_price    numeric(12,2) not null,
  profit         numeric(12,2) not null,
  created_at     timestamptz not null default now()
);

-- Also create suppliers if missing
create table if not exists public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops (id) on delete cascade,
  name         text not null,
  contact_name text,
  phone        text,
  email        text,
  address      text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Also create notifications if missing
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  shop_id    uuid references public.shops (id) on delete cascade,
  type       text not null check (type in ('low_stock','out_of_stock','expiry','ai_recommendation','system')),
  title      text not null,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- Also create user_settings if missing
create table if not exists public.user_settings (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  active_shop_id   uuid references public.shops (id) on delete set null,
  currency         text not null default 'INR',
  timezone         text not null default 'Asia/Kolkata',
  low_stock_alerts boolean not null default true,
  expiry_alerts    boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- RLS for new tables
alter table public.sale_items    enable row level security;
alter table public.suppliers     enable row level security;
alter table public.notifications enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "sale_items_by_shop_owner"    on public.sale_items;
create policy "sale_items_by_shop_owner" on public.sale_items
for all to authenticated
using (exists (
  select 1 from public.sales sa
  join public.shops s on s.id = sa.shop_id
  where sa.id = sale_items.sale_id and s.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.sales sa
  join public.shops s on s.id = sa.shop_id
  where sa.id = sale_items.sale_id and s.owner_id = auth.uid()
));

drop policy if exists "suppliers_crud_by_shop_owner" on public.suppliers;
create policy "suppliers_crud_by_shop_owner" on public.suppliers
for all to authenticated
using (exists (select 1 from public.shops s where s.id = suppliers.shop_id and s.owner_id = auth.uid()))
with check (exists (select 1 from public.shops s where s.id = suppliers.shop_id and s.owner_id = auth.uid()));

drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications
for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user_settings_own" on public.user_settings;
create policy "user_settings_own" on public.user_settings
for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
