-- SmartStock AI - Full schema
-- Run in Supabase SQL editor before using the app.

-- Extensions
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- SHOPS
-- ─────────────────────────────────────────────
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('retail','grocery','pharmacy','wholesale','vendor','other')),
  address text not null,
  phone text not null,
  gst_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  sku text not null,
  category text not null,
  brand text,
  cost_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  quantity integer not null default 0,
  reorder_threshold integer not null default 0,
  expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, sku)
);

-- ─────────────────────────────────────────────
-- INVENTORY LOGS
-- ─────────────────────────────────────────────
create table if not exists public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('increase','decrease','sale','adjust')),
  delta integer not null,
  note text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- SALES
-- ─────────────────────────────────────────────
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_name text,
  customer_phone text,
  total_amount numeric(12,2) not null default 0,
  profit_amount numeric(12,2) not null default 0,
  payment_method text not null default 'cash' check (payment_method in ('cash','upi','card','credit','other')),
  status text not null default 'paid' check (status in ('paid','pending','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- SALE ITEMS
-- ─────────────────────────────────────────────
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  product_name text not null,
  sku text not null,
  quantity integer not null,
  cost_price numeric(12,2) not null,
  selling_price numeric(12,2) not null,
  total_price numeric(12,2) not null,
  profit numeric(12,2) not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- SUPPLIERS
-- ─────────────────────────────────────────────
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  shop_id uuid references public.shops (id) on delete cascade,
  type text not null check (type in ('low_stock','out_of_stock','expiry','ai_recommendation','system')),
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- USER SETTINGS
-- ─────────────────────────────────────────────
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active_shop_id uuid references public.shops (id) on delete set null,
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  low_stock_alerts boolean not null default true,
  expiry_alerts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_shops_updated_at on public.shops;
create trigger trg_shops_updated_at before update on public.shops
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at before update on public.products
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_suppliers_updated_at on public.suppliers;
create trigger trg_suppliers_updated_at before update on public.suppliers
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at before update on public.user_settings
for each row execute procedure public.set_updated_at();

-- ─────────────────────────────────────────────
-- AUTO-CREATE PROFILE + SETTINGS ON SIGNUP
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email));

  insert into public.user_settings (user_id)
  values (new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.inventory_logs enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.suppliers enable row level security;
alter table public.notifications enable row level security;
alter table public.user_settings enable row level security;

-- Profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Shops
drop policy if exists "shops_crud_own" on public.shops;
create policy "shops_crud_own" on public.shops
for all to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Products
drop policy if exists "products_crud_by_shop_owner" on public.products;
create policy "products_crud_by_shop_owner" on public.products
for all to authenticated
using (exists (select 1 from public.shops s where s.id = products.shop_id and s.owner_id = auth.uid()))
with check (exists (select 1 from public.shops s where s.id = products.shop_id and s.owner_id = auth.uid()));

-- Inventory logs
drop policy if exists "inventory_logs_select_by_shop_owner" on public.inventory_logs;
create policy "inventory_logs_select_by_shop_owner" on public.inventory_logs
for select to authenticated
using (exists (select 1 from public.shops s where s.id = inventory_logs.shop_id and s.owner_id = auth.uid()));

drop policy if exists "inventory_logs_insert_by_shop_owner" on public.inventory_logs;
create policy "inventory_logs_insert_by_shop_owner" on public.inventory_logs
for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from public.shops s where s.id = inventory_logs.shop_id and s.owner_id = auth.uid()));

-- Sales
drop policy if exists "sales_crud_by_shop_owner" on public.sales;
create policy "sales_crud_by_shop_owner" on public.sales
for all to authenticated
using (exists (select 1 from public.shops s where s.id = sales.shop_id and s.owner_id = auth.uid()))
with check (user_id = auth.uid() and exists (select 1 from public.shops s where s.id = sales.shop_id and s.owner_id = auth.uid()));

-- Sale items (access via sale ownership)
drop policy if exists "sale_items_by_shop_owner" on public.sale_items;
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

-- Suppliers
drop policy if exists "suppliers_crud_by_shop_owner" on public.suppliers;
create policy "suppliers_crud_by_shop_owner" on public.suppliers
for all to authenticated
using (exists (select 1 from public.shops s where s.id = suppliers.shop_id and s.owner_id = auth.uid()))
with check (exists (select 1 from public.shops s where s.id = suppliers.shop_id and s.owner_id = auth.uid()));

-- Notifications
drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications
for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- User settings
drop policy if exists "user_settings_own" on public.user_settings;
create policy "user_settings_own" on public.user_settings
for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
