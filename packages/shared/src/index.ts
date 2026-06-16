import { z } from 'zod'

// ─── Shop ────────────────────────────────────────────────────────────────────
export const ShopType = z.enum(['retail','grocery','pharmacy','wholesale','vendor','other'])
export type ShopType = z.infer<typeof ShopType>

export const ShopCreateSchema = z.object({
  name: z.string().min(2, 'Shop name is required'),
  type: ShopType,
  address: z.string().min(3, 'Address is required'),
  phone: z.string().min(7).max(20),
  gst_number: z.string().min(5).max(32).optional().nullable(),
})
export type ShopCreateInput = z.infer<typeof ShopCreateSchema>

// ─── Product ─────────────────────────────────────────────────────────────────
export const ProductSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  category: z.string().min(1, 'Category is required'),
  brand: z.string().optional().nullable(),
  cost_price: z.number().nonnegative(),
  selling_price: z.number().nonnegative(),
  quantity: z.number().int().nonnegative(),
  reorder_threshold: z.number().int().nonnegative(),
  expiry_date: z.string().optional().nullable(),
})
export type ProductInput = z.infer<typeof ProductSchema>

// ─── Sale ─────────────────────────────────────────────────────────────────────
export const SaleItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string(),
  sku: z.string(),
  quantity: z.number().int().min(1),
  cost_price: z.number().nonnegative(),
  selling_price: z.number().nonnegative(),
})
export type SaleItemInput = z.infer<typeof SaleItemSchema>

export const PaymentMethod = z.enum(['cash','upi','card','credit','other'])
export type PaymentMethod = z.infer<typeof PaymentMethod>

export const SaleCreateSchema = z.object({
  customer_name: z.string().optional().nullable(),
  customer_phone: z.string().optional().nullable(),
  payment_method: PaymentMethod,
  notes: z.string().optional().nullable(),
  items: z.array(SaleItemSchema).min(1, 'Add at least one item'),
})
export type SaleCreateInput = z.infer<typeof SaleCreateSchema>

// ─── Supplier ────────────────────────────────────────────────────────────────
export const SupplierSchema = z.object({
  name: z.string().min(2, 'Supplier name is required'),
  contact_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})
export type SupplierInput = z.infer<typeof SupplierSchema>

// ─── Inventory adjustment ────────────────────────────────────────────────────
export const InventoryAdjustSchema = z.object({
  product_id: z.string().uuid(),
  action: z.enum(['increase','decrease','adjust']),
  delta: z.number().int().min(1),
  note: z.string().optional().nullable(),
})
export type InventoryAdjustInput = z.infer<typeof InventoryAdjustSchema>

// ─── Purchase Order ──────────────────────────────────────────────────────────
export const PurchaseOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  unit_cost: z.number().nonnegative(),
})
export type PurchaseOrderItemInput = z.infer<typeof PurchaseOrderItemSchema>

export const PurchaseOrderCreateSchema = z.object({
  supplier_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(PurchaseOrderItemSchema).min(1, 'Add at least one item'),
})
export type PurchaseOrderCreateInput = z.infer<typeof PurchaseOrderCreateSchema>

// ─── Feedback ────────────────────────────────────────────────────────────────
export const ContactUsSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  message: z.string().min(1).max(2000),
})
export type ContactUsInput = z.infer<typeof ContactUsSchema>

export const FeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  type: z.enum(['feature_request','bug','general','complaint']),
  description: z.string().min(1).max(2000),
})
export type FeedbackInput = z.infer<typeof FeedbackSchema>

export const BugReportSchema = z.object({
  description: z.string().min(1).max(2000),
})
export type BugReportInput = z.infer<typeof BugReportSchema>

// ─── Voice Intent ────────────────────────────────────────────────────────────
export const VoiceIntentSchema = z.object({
  action: z.enum(['add','remove','create','unknown']),
  product_name: z.string(),
  quantity: z.number().int().min(0),
  cost_price: z.number().nonnegative().optional(),
  selling_price: z.number().nonnegative().optional(),
})
export type VoiceIntent = z.infer<typeof VoiceIntentSchema>
