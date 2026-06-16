-- ============================================================
-- SmartStock AI — Demo Seed Data
-- Account: ketanarora7890@gmail.com
-- Run this in Supabase SQL Editor AFTER the schema.sql has been run.
-- ============================================================

DO $$
DECLARE
  v_user_id     uuid;
  v_shop_id     uuid;
  v_prod_maggi  uuid;
  v_prod_cola   uuid;
  v_prod_chips  uuid;
  v_prod_bread  uuid;
  v_prod_milk   uuid;
  v_prod_rice   uuid;
  v_prod_daal   uuid;
  v_prod_oil    uuid;
  v_prod_soap   uuid;
  v_prod_biscuit uuid;
  v_sale_1      uuid;
  v_sale_2      uuid;
  v_sale_3      uuid;
  v_sale_4      uuid;
  v_sale_5      uuid;
BEGIN

  -- ── 1. Resolve user ──────────────────────────────────────────
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'ketanarora7890@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ketanarora7890@gmail.com not found. Make sure you are signed up first.';
  END IF;

  -- ── 2. Clean up any existing demo data for this user ─────────
  DELETE FROM public.shops WHERE owner_id = v_user_id;

  -- ── 3. Create shop ───────────────────────────────────────────
  v_shop_id := gen_random_uuid();

  INSERT INTO public.shops (id, owner_id, name, type, address, phone, gst_number)
  VALUES (
    v_shop_id,
    v_user_id,
    'Arora General Store',
    'grocery',
    '12, Sector 18, Noida, Uttar Pradesh - 201301',
    '9876543210',
    '09AAAAA0000A1Z5'
  );

  -- ── 4. Create products ───────────────────────────────────────
  v_prod_maggi  := gen_random_uuid();
  v_prod_cola   := gen_random_uuid();
  v_prod_chips  := gen_random_uuid();
  v_prod_bread  := gen_random_uuid();
  v_prod_milk   := gen_random_uuid();
  v_prod_rice   := gen_random_uuid();
  v_prod_daal   := gen_random_uuid();
  v_prod_oil    := gen_random_uuid();
  v_prod_soap   := gen_random_uuid();
  v_prod_biscuit := gen_random_uuid();

  INSERT INTO public.products
    (id, shop_id, name, sku, category, brand, cost_price, selling_price, quantity, reorder_threshold, expiry_date)
  VALUES
    (v_prod_maggi,   v_shop_id, 'Maggi Noodles 70g',        'MGG-001', 'Snacks',         'Nestlé',       10.00,  14.00,  120, 30,  '2026-12-31'),
    (v_prod_cola,    v_shop_id, 'Coca Cola 500ml',           'CCA-001', 'Beverages',       'Coca-Cola',    25.00,  35.00,    8, 20,  '2026-06-30'),
    (v_prod_chips,   v_shop_id, 'Lay''s Classic Salted 26g', 'LYS-001', 'Snacks',         'PepsiCo',       8.00,  10.00,   85, 25,  '2026-09-15'),
    (v_prod_bread,   v_shop_id, 'Britannia Bread 400g',      'BRD-001', 'Dairy',           'Britannia',    28.00,  35.00,    3, 10,  '2026-06-18'),
    (v_prod_milk,    v_shop_id, 'Amul Full Cream Milk 500ml','MLK-001', 'Dairy',           'Amul',         24.00,  28.00,   45, 15,  '2026-06-20'),
    (v_prod_rice,    v_shop_id, 'India Gate Basmati 1kg',    'RCE-001', 'Grains & Pulses', 'KRBL',         65.00,  85.00,   60, 20,  NULL),
    (v_prod_daal,    v_shop_id, 'Toor Dal 500g',             'DAL-001', 'Grains & Pulses', 'Patanjali',    40.00,  52.00,   35, 15,  NULL),
    (v_prod_oil,     v_shop_id, 'Fortune Sunflower Oil 1L',  'OIL-001', 'Spices',          'Fortune',     105.00, 130.00,   22, 10,  '2027-01-01'),
    (v_prod_soap,    v_shop_id, 'Lux Soap 100g',             'SPO-001', 'Personal Care',   'HUL',          18.00,  25.00,    0, 20,  NULL),
    (v_prod_biscuit, v_shop_id, 'Parle-G Biscuits 100g',     'BSC-001', 'Snacks',          'Parle',         8.00,  10.00,  200, 50,  '2027-03-31');

  -- ── 5. Inventory logs (stock history) ────────────────────────
  INSERT INTO public.inventory_logs
    (shop_id, product_id, user_id, action, delta, note, created_at)
  VALUES
    -- Initial stock entries
    (v_shop_id, v_prod_maggi,   v_user_id, 'increase', 150, 'Initial stock', now() - interval '30 days'),
    (v_shop_id, v_prod_cola,    v_user_id, 'increase',  50, 'Initial stock', now() - interval '30 days'),
    (v_shop_id, v_prod_chips,   v_user_id, 'increase', 100, 'Initial stock', now() - interval '30 days'),
    (v_shop_id, v_prod_bread,   v_user_id, 'increase',  20, 'Initial stock', now() - interval '30 days'),
    (v_shop_id, v_prod_milk,    v_user_id, 'increase',  60, 'Initial stock', now() - interval '30 days'),
    (v_shop_id, v_prod_rice,    v_user_id, 'increase',  80, 'Initial stock', now() - interval '30 days'),
    (v_shop_id, v_prod_daal,    v_user_id, 'increase',  50, 'Initial stock', now() - interval '30 days'),
    (v_shop_id, v_prod_oil,     v_user_id, 'increase',  30, 'Initial stock', now() - interval '30 days'),
    (v_shop_id, v_prod_soap,    v_user_id, 'increase',  40, 'Initial stock', now() - interval '30 days'),
    (v_shop_id, v_prod_biscuit, v_user_id, 'increase', 250, 'Initial stock', now() - interval '30 days'),
    -- Sales deductions (simulated)
    (v_shop_id, v_prod_maggi,   v_user_id, 'sale', -30, 'Sales', now() - interval '20 days'),
    (v_shop_id, v_prod_cola,    v_user_id, 'sale', -42, 'Sales', now() - interval '18 days'),
    (v_shop_id, v_prod_chips,   v_user_id, 'sale', -15, 'Sales', now() - interval '15 days'),
    (v_shop_id, v_prod_bread,   v_user_id, 'sale', -17, 'Sales', now() - interval '12 days'),
    (v_shop_id, v_prod_milk,    v_user_id, 'sale', -15, 'Sales', now() - interval '10 days'),
    (v_shop_id, v_prod_soap,    v_user_id, 'sale', -40, 'Sales', now() - interval '8 days'),
    (v_shop_id, v_prod_biscuit, v_user_id, 'sale', -50, 'Sales', now() - interval '5 days'),
    -- Restock
    (v_shop_id, v_prod_maggi,   v_user_id, 'increase', 0,  'Restock from supplier', now() - interval '10 days');

  -- ── 6. Sales ─────────────────────────────────────────────────
  v_sale_1 := gen_random_uuid();
  v_sale_2 := gen_random_uuid();
  v_sale_3 := gen_random_uuid();
  v_sale_4 := gen_random_uuid();
  v_sale_5 := gen_random_uuid();

  INSERT INTO public.sales
    (id, shop_id, user_id, customer_name, customer_phone, total_amount, profit_amount, payment_method, status, created_at)
  VALUES
    (v_sale_1, v_shop_id, v_user_id, 'Rahul Sharma',   '9812345670', 198.00,  62.00, 'cash', 'paid', now() - interval '14 days'),
    (v_sale_2, v_shop_id, v_user_id, 'Priya Singh',    '9823456781', 325.00,  98.00, 'upi',  'paid', now() - interval '10 days'),
    (v_sale_3, v_shop_id, v_user_id, NULL,             NULL,         154.00,  44.00, 'cash', 'paid', now() - interval '7 days'),
    (v_sale_4, v_shop_id, v_user_id, 'Amit Verma',     '9834567892', 510.00, 145.00, 'upi',  'paid', now() - interval '4 days'),
    (v_sale_5, v_shop_id, v_user_id, 'Sunita Agarwal', '9845678903', 268.00,  80.00, 'card', 'paid', now() - interval '1 day');

  -- ── 7. Sale items ────────────────────────────────────────────
  INSERT INTO public.sale_items
    (sale_id, product_id, product_name, sku, quantity, cost_price, selling_price, total_price, profit)
  VALUES
    -- Sale 1: Rahul Sharma
    (v_sale_1, v_prod_maggi,   'Maggi Noodles 70g',        'MGG-001', 5,  10.00, 14.00,  70.00,  20.00),
    (v_sale_1, v_prod_cola,    'Coca Cola 500ml',           'CCA-001', 2,  25.00, 35.00,  70.00,  20.00),
    (v_sale_1, v_prod_chips,   'Lay''s Classic Salted 26g','LYS-001', 3,   8.00, 10.00,  30.00,   6.00),
    (v_sale_1, v_prod_biscuit, 'Parle-G Biscuits 100g',    'BSC-001', 2,   8.00, 14.00,  28.00,  12.00),
    -- Sale 2: Priya Singh
    (v_sale_2, v_prod_rice,  'India Gate Basmati 1kg',    'RCE-001', 2,  65.00,  85.00, 170.00,  40.00),
    (v_sale_2, v_prod_daal,  'Toor Dal 500g',             'DAL-001', 1,  40.00,  52.00,  52.00,  12.00),
    (v_sale_2, v_prod_oil,   'Fortune Sunflower Oil 1L',  'OIL-001', 1, 105.00, 130.00, 130.00,  25.00),
    -- Sale 3: Walk-in
    (v_sale_3, v_prod_milk,    'Amul Full Cream Milk 500ml','MLK-001', 3, 24.00,  28.00,  84.00,  12.00),
    (v_sale_3, v_prod_bread,   'Britannia Bread 400g',      'BRD-001', 2, 28.00,  35.00,  70.00,  14.00),
    -- Sale 4: Amit Verma
    (v_sale_4, v_prod_rice,    'India Gate Basmati 1kg',   'RCE-001', 3,  65.00,  85.00, 255.00,  60.00),
    (v_sale_4, v_prod_oil,     'Fortune Sunflower Oil 1L', 'OIL-001', 1, 105.00, 130.00, 130.00,  25.00),
    (v_sale_4, v_prod_biscuit, 'Parle-G Biscuits 100g',    'BSC-001', 5,   8.00,  10.00,  50.00,  10.00),
    (v_sale_4, v_prod_milk,    'Amul Full Cream Milk 500ml','MLK-001', 3,  24.00,  28.00,  84.00,  12.00),
    -- Sale 5: Sunita Agarwal
    (v_sale_5, v_prod_maggi,   'Maggi Noodles 70g',        'MGG-001', 4,  10.00,  14.00,  56.00,  16.00),
    (v_sale_5, v_prod_chips,   'Lay''s Classic Salted 26g','LYS-001', 5,   8.00,  10.00,  50.00,  10.00),
    (v_sale_5, v_prod_cola,    'Coca Cola 500ml',           'CCA-001', 2,  25.00,  35.00,  70.00,  20.00),
    (v_sale_5, v_prod_daal,    'Toor Dal 500g',             'DAL-001', 1,  40.00,  52.00,  52.00,  12.00),
    (v_sale_5, v_prod_biscuit, 'Parle-G Biscuits 100g',    'BSC-001', 4,   8.00,  10.00,  40.00,   8.00);

  -- ── 8. Suppliers ─────────────────────────────────────────────
  INSERT INTO public.suppliers
    (shop_id, name, contact_name, phone, email, address)
  VALUES
    (v_shop_id, 'Nestlé India Distributor',  'Rajesh Kumar',  '9911223344', 'rajesh@nestledist.com',   'Sector 62, Noida'),
    (v_shop_id, 'Metro Cash & Carry',        'Vikram Mehra',  '9922334455', 'vikram@metro.in',         'NH-24, Ghaziabad'),
    (v_shop_id, 'PepsiCo Distributor',       'Suresh Gupta',  '9933445566', 'suresh@pepsidist.com',    'Sector 6, Noida');

  -- ── 9. Notifications ─────────────────────────────────────────
  INSERT INTO public.notifications
    (user_id, shop_id, type, title, body, read, created_at)
  VALUES
    (v_user_id, v_shop_id, 'low_stock',     'Low Stock Alert',     'Coca Cola 500ml is running low (8 units left). Reorder threshold is 20.',      false, now() - interval '2 days'),
    (v_user_id, v_shop_id, 'out_of_stock',  'Out of Stock',        'Lux Soap 100g is out of stock. Last sold 8 days ago.',                          false, now() - interval '1 day'),
    (v_user_id, v_shop_id, 'low_stock',     'Low Stock Alert',     'Britannia Bread 400g is critically low (3 units left).',                        false, now() - interval '12 hours'),
    (v_user_id, v_shop_id, 'expiry',        'Expiry Alert',        'Coca Cola 500ml expires on 30 Jun 2026. Consider running a promotion.',         false, now() - interval '6 hours'),
    (v_user_id, v_shop_id, 'ai_recommendation', 'AI Recommendation', 'Based on sales trends, consider restocking Parle-G and Maggi before weekend.', true,  now() - interval '3 days');

  -- ── 10. Update user_settings with active shop ────────────────
  INSERT INTO public.user_settings (user_id, active_shop_id)
  VALUES (v_user_id, v_shop_id)
  ON CONFLICT (user_id) DO UPDATE SET active_shop_id = v_shop_id;

  RAISE NOTICE '✅ Seed complete for user % — shop: Arora General Store', v_user_id;

END $$;
