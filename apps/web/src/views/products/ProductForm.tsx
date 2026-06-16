import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ProductSchema, type ProductInput } from '@smartstock/shared'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/form/Button'
import { Input } from '../../ui/form/Input'
import type { Product } from './ProductsPage'

const CATEGORIES = [
  'Beverages', 'Dairy', 'Snacks', 'Grains & Pulses', 'Spices',
  'Personal Care', 'Medicines', 'Electronics', 'Clothing', 'Stationery', 'Other',
]

export function ProductForm({
  shopId,
  product,
  onSuccess,
}: {
  shopId: string
  product?: Product
  onSuccess: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isEdit = Boolean(product)

  const form = useForm<ProductInput>({
    resolver: zodResolver(ProductSchema),
    defaultValues: product
      ? {
          name: product.name,
          sku: product.sku,
          category: product.category,
          brand: product.brand ?? '',
          cost_price: product.cost_price,
          selling_price: product.selling_price,
          quantity: product.quantity,
          reorder_threshold: product.reorder_threshold,
          expiry_date: product.expiry_date ?? '',
        }
      : {
          name: '',
          sku: '',
          category: '',
          brand: '',
          cost_price: 0,
          selling_price: 0,
          quantity: 0,
          reorder_threshold: 5,
          expiry_date: '',
        },
  })

  async function onSubmit(values: ProductInput) {
    if (!supabase) return
    setLoading(true)
    setError(null)

    const payload = {
      ...values,
      shop_id: shopId,
      brand: values.brand || null,
      expiry_date: values.expiry_date || null,
    }

    const { error: err } = isEdit
      ? await supabase.from('products').update(payload).eq('id', product!.id)
      : await supabase.from('products').insert(payload)

    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    onSuccess()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Product Name *</label>
          <Input type="text" placeholder="e.g. Maggi Noodles" {...form.register('name')} />
          {form.formState.errors.name && <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">SKU *</label>
          <Input type="text" placeholder="e.g. MGG-001" {...form.register('sku')} />
          {form.formState.errors.sku && <p className="mt-1 text-xs text-red-600">{form.formState.errors.sku.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Category *</label>
          <select
            {...form.register('category')}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option value="">Select category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {form.formState.errors.category && <p className="mt-1 text-xs text-red-600">{form.formState.errors.category.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Brand</label>
          <Input type="text" placeholder="e.g. Nestlé" {...form.register('brand')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Cost Price (₹) *</label>
          <Input type="number" placeholder="0.00" {...form.register('cost_price')} />
          {form.formState.errors.cost_price && <p className="mt-1 text-xs text-red-600">{form.formState.errors.cost_price.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Selling Price (₹) *</label>
          <Input type="number" placeholder="0.00" {...form.register('selling_price')} />
          {form.formState.errors.selling_price && <p className="mt-1 text-xs text-red-600">{form.formState.errors.selling_price.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Quantity *</label>
          <Input type="number" placeholder="0" {...form.register('quantity')} />
          {form.formState.errors.quantity && <p className="mt-1 text-xs text-red-600">{form.formState.errors.quantity.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Reorder Threshold</label>
          <Input type="number" placeholder="5" {...form.register('reorder_threshold')} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Expiry Date</label>
        <Input type="date" {...form.register('expiry_date')} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'Update Product' : 'Add Product'}
        </Button>
      </div>
    </form>
  )
}
