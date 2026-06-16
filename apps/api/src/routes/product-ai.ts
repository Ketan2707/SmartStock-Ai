import { Router } from 'express'
import { z } from 'zod'
import { generateProductMetadata } from '../services/gemini.js'

const router = Router()

// POST /ai/product-metadata — AI-generate SKU, category, brand, tags, etc.
router.post('/product-metadata', async (req, res) => {
  const schema = z.object({
    product_name: z.string().min(1),
    shop_type: z.string().optional().default('retail'),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  try {
    const metadata = await generateProductMetadata(parsed.data.product_name, parsed.data.shop_type)
    if (!metadata) {
      // Fallback
      const ts = Date.now().toString().slice(-6)
      const prefix = parsed.data.product_name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')
      return res.json({
        ok: true,
        metadata: {
          sku: `${prefix}-${ts}`,
          category: 'Other',
          brand: '',
          tags: [],
          reorder_threshold: 10,
          search_keywords: [parsed.data.product_name.toLowerCase()],
        },
        fallback: true,
      })
    }
    return res.json({ ok: true, metadata, fallback: false })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

export default router
