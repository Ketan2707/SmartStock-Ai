import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { SaleCreateSchema, type SaleCreateInput } from '@smartstock/shared'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Button } from '../../ui/form/Button'
import { Input } from '../../ui/form/Input'
import { Select } from '../../ui/form/Select'
import type { Product } from '../products/ProductsPage'

export function NewSaleForm({
  shopId,
  onSuccess,
}: {
  shopId: string
  shopName: string
  onSuccess: () => void
}) {
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { data: products = [] } = useQuery({
    queryKey: ['products', shopId],
    queryFn: async () => {
      if (!supabase) return []
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', shopId)
        .gt('quantity', 0)
        .order('name')
      return (data ?? []) as Product[]
    },
    enabled: Boolean(shopId),
  })

  const form = useForm<SaleCreateInput>({
    resolver: zodResolver(SaleCreateSchema),
    defaultValues: {
      customer_name: '',
      customer_phone: '',
      payment_method: 'cash' as const,
      notes: '',
      items: [{ product_id: '', product_name: '', sku: '', quantity: 1, cost_price: 0, selling_price: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })

  const items = form.watch('items')

  const totals = items.reduce(
    (acc: { total: number; profit: number }, item: typeof items[0]) => {
      const qty = Number(item.quantity) || 0
      const sp = Number(item.selling_price) || 0
      const cp = Number(item.cost_price) || 0
      return {
        total: acc.total + qty * sp,
        profit: acc.profit + qty * (sp - cp),
      }
    },
    { total: 0, profit: 0 },
  )

  function onProductSelect(idx: number, productId: string) {
    const p = products.find((pr) => pr.id === productId)
    if (!p) return
    form.setValue(`items.${idx}.product_id`, p.id)
    form.setValue(`items.${idx}.product_name`, p.name)
    form.setValue(`items.${idx}.sku`, p.sku)
    form.setValue(`items.${idx}.cost_price`, p.cost_price)
    form.setValue(`items.${idx}.selling_price`, p.selling_price)
  }

  async function onSubmit(values: SaleCreateInput) {
    if (!supabase || !user) return
    setLoading(true)
    setError(null)

    const totalAmount = values.items.reduce((s: number, i: typeof values.items[0]) => s + Number(i.quantity) * Number(i.selling_price), 0)
    const profitAmount = values.items.reduce(
      (s: number, i: typeof values.items[0]) => s + Number(i.quantity) * (Number(i.selling_price) - Number(i.cost_price)),
      0,
    )

    // Insert sale
    const { data: saleData, error: saleErr } = await supabase
      .from('sales')
      .insert({
        shop_id: shopId,
        user_id: user.id,
        customer_name: values.customer_name || null,
        customer_phone: values.customer_phone || null,
        total_amount: totalAmount,
        profit_amount: profitAmount,
        payment_method: values.payment_method,
        status: 'paid',
        notes: values.notes || null,
      })
      .select()
      .single()

    if (saleErr || !saleData) {
      setError(saleErr?.message ?? 'Failed to create sale')
      setLoading(false)
      return
    }

    // Insert sale items
    const saleItems = values.items.map((item: typeof values.items[0]) => ({
      sale_id: saleData.id,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      quantity: Number(item.quantity),
      cost_price: Number(item.cost_price),
      selling_price: Number(item.selling_price),
      total_price: Number(item.quantity) * Number(item.selling_price),
      profit: Number(item.quantity) * (Number(item.selling_price) - Number(item.cost_price)),
    }))

    const { error: itemsErr } = await supabase.from('sale_items').insert(saleItems)
    if (itemsErr) { setError(itemsErr.message); setLoading(false); return }

    // Deduct inventory + log
    for (const item of values.items) {
      const product = products.find((p) => p.id === item.product_id)
      if (!product) continue
      const newQty = Math.max(0, product.quantity - Number(item.quantity))

      await supabase.from('products').update({ quantity: newQty }).eq('id', item.product_id)

      await supabase.from('inventory_logs').insert({
        shop_id: shopId,
        product_id: item.product_id,
        user_id: user.id,
        action: 'sale',
        delta: -Number(item.quantity),
        note: `Sale ${saleData.id.slice(0, 8).toUpperCase()}`,
      })
    }

    setLoading(false)
    onSuccess()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
            Customer Name <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <Input placeholder="Walk-in customer" {...form.register('customer_name')} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
            Phone <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <Input placeholder="9876543210" {...form.register('customer_phone')} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Payment Method</label>
        <Select {...form.register('payment_method')}>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="credit">Credit</option>
          <option value="other">Other</option>
        </Select>
      </div>

      {/* Items */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Items *</label>
          <button
            type="button"
            onClick={() =>
              append({ product_id: '', product_name: '', sku: '', quantity: 1, cost_price: 0, selling_price: 0 })
            }
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <Plus size={12} /> Add item
          </button>
        </div>

        <div className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
          {fields.map((field, idx) => {
            const item = items[idx]
            const lineTotal = (Number(item?.quantity) || 0) * (Number(item?.selling_price) || 0)
            return (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  {idx === 0 && <div className="mb-1 text-xs text-slate-500">Product</div>}
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                    value={item?.product_id ?? ''}
                    onChange={(e) => onProductSelect(idx, e.target.value)}
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.quantity})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  {idx === 0 && <div className="mb-1 text-xs text-slate-500">Qty</div>}
                  <Input
                    type="number"
                    min="1"
                    className="py-1.5 text-xs"
                    {...form.register(`items.${idx}.quantity`)}
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <div className="mb-1 text-xs text-slate-500">Price (₹)</div>}
                  <Input
                    type="number"
                    step="0.01"
                    className="py-1.5 text-xs"
                    {...form.register(`items.${idx}.selling_price`)}
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <div className="mb-1 text-xs text-slate-500">Total</div>}
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800">
                    ₹{lineTotal.toFixed(2)}
                  </div>
                </div>
                <div className="col-span-1 flex justify-end">
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="rounded p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {form.formState.errors.items?.root && (
            <p className="text-xs text-red-600">{form.formState.errors.items.root.message}</p>
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-300">Total Amount</span>
          <span className="font-semibold">₹{totals.total.toFixed(2)}</span>
        </div>
        <div className="mt-1 flex justify-between text-xs">
          <span className="text-slate-500">Profit</span>
          <span className="text-emerald-600 font-medium">₹{totals.profit.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating sale…' : 'Complete Sale'}
        </Button>
      </div>
    </form>
  )
}
