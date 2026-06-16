import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { businessChat } from '../services/gemini.js'

const router = Router()

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured on API server')
  return createClient(url, key)
}

// POST /ai/chat — business assistant chat
router.post('/chat', async (req, res) => {
  const schema = z.object({
    shop_id: z.string().uuid(),
    user_id: z.string().uuid(),
    message: z.string().min(1).max(2000),
    history: z
      .array(z.object({ role: z.enum(['user', 'assistant']), message: z.string() }))
      .optional()
      .default([]),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { shop_id, user_id, message, history } = parsed.data

  try {
    const supabase = getSupabase()

    // Build context snapshot
    const [productsRes, salesRes, saleItemsRes] = await Promise.all([
      supabase
        .from('products')
        .select('name, sku, category, quantity, cost_price, selling_price, reorder_threshold')
        .eq('shop_id', shop_id)
        .limit(50),
      supabase
        .from('sales')
        .select('total_amount, profit_amount, created_at')
        .eq('shop_id', shop_id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('sale_items')
        .select('product_name, quantity, selling_price')
        .eq('shop_id', shop_id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    const products = productsRes.data ?? []
    const sales = salesRes.data ?? []
    const saleItems = saleItemsRes.data ?? []

    const totalRevenue = sales.reduce((s: number, r) => s + Number(r.total_amount), 0)
    const totalProfit = sales.reduce((s: number, r) => s + Number(r.profit_amount), 0)

    // Top products by quantity sold
    const productSales: Record<string, number> = {}
    for (const item of saleItems) {
      productSales[item.product_name] = (productSales[item.product_name] ?? 0) + item.quantity
    }
    const topProducts = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, qty]) => ({ name, quantity_sold: qty }))

    const lowStock = products.filter(
      (p) => p.quantity <= p.reorder_threshold && p.quantity > 0,
    )
    const outOfStock = products.filter((p) => p.quantity === 0)

    const context = {
      total_products: products.length,
      low_stock_products: lowStock.map((p) => ({ name: p.name, quantity: p.quantity, threshold: p.reorder_threshold })),
      out_of_stock_products: outOfStock.map((p) => p.name),
      last_30_days: {
        total_sales: sales.length,
        total_revenue: `₹${totalRevenue.toFixed(2)}`,
        total_profit: `₹${totalProfit.toFixed(2)}`,
      },
      top_10_selling_products: topProducts,
      inventory_value: `₹${products.reduce((s, p) => s + p.cost_price * p.quantity, 0).toFixed(2)}`,
    }

    const reply = await businessChat(message, history, context as Record<string, unknown>)

    // Store in chat_history
    await supabase.from('chat_history').insert([
      { shop_id, user_id, role: 'user', message },
      { shop_id, user_id, role: 'assistant', message: reply },
    ])

    return res.json({ ok: true, reply })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

export default router
