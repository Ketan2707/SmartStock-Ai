import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { BarChart3, History } from 'lucide-react'
import { InventoryAdjustSchema, type InventoryAdjustInput } from '@smartstock/shared'
import { supabase } from '../../lib/supabase'
import { useShop } from '../../lib/shop'
import { useAuth } from '../../lib/auth'
import { Button } from '../../ui/form/Button'
import { Input } from '../../ui/form/Input'
import { Select } from '../../ui/form/Select'
import { Badge } from '../../ui/common/Badge'
import { Modal } from '../../ui/common/Modal'
import { Spinner } from '../../ui/common/Spinner'
import { EmptyState } from '../../ui/common/EmptyState'
import { PageHeader } from '../../ui/common/PageHeader'
import type { Product } from '../products/ProductsPage'

type InventoryLog = {
  id: string
  product_id: string
  action: string
  delta: number
  note: string | null
  created_at: string
  products: { name: string; sku: string } | null
}

export function InventoryPage() {
  const { activeShop } = useShop()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [tab, setTab] = useState<'stock' | 'logs'>('stock')

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', activeShop?.id],
    queryFn: async () => {
      if (!activeShop || !supabase) return []
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', activeShop.id)
        .order('name')
      return (data ?? []) as Product[]
    },
    enabled: Boolean(activeShop),
  })

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['inventory_logs', activeShop?.id],
    queryFn: async () => {
      if (!activeShop || !supabase) return []
      const { data } = await supabase
        .from('inventory_logs')
        .select('*, products(name, sku)')
        .eq('shop_id', activeShop.id)
        .order('created_at', { ascending: false })
        .limit(200)
      return (data ?? []) as InventoryLog[]
    },
    enabled: Boolean(activeShop) && tab === 'logs',
  })

  const lowStock = products.filter((p) => p.quantity > 0 && p.quantity <= p.reorder_threshold)
  const outOfStock = products.filter((p) => p.quantity === 0)

  return (
    <div className="p-6">
      <PageHeader
        title="Inventory"
        description="Track stock levels, make adjustments, and view history."
      />

      {/* Summary cards */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Products" value={products.length} />
        <SummaryCard label="Low Stock" value={lowStock.length} variant="warning" />
        <SummaryCard label="Out of Stock" value={outOfStock.length} variant="danger" />
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {(['stock', 'logs'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              'px-4 py-2 text-sm font-medium capitalize',
              tab === t
                ? 'border-b-2 border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            ].join(' ')}
          >
            {t === 'stock' ? 'Current Stock' : 'Adjustment History'}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : products.length === 0 ? (
            <EmptyState
              icon={<BarChart3 size={40} />}
              title="No products found"
              description="Add products first, then manage their stock here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    {['Product', 'SKU', 'Category', 'Qty', 'Threshold', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.category}</td>
                      <td className="px-4 py-3 font-semibold">{p.quantity}</td>
                      <td className="px-4 py-3 text-slate-500">{p.reorder_threshold}</td>
                      <td className="px-4 py-3">
                        <StockBadge product={p} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setAdjustProduct(p)}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {logsLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={<History size={40} />}
              title="No adjustments yet"
              description="Stock changes will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    {['Product', 'Action', 'Change', 'Note', 'Date'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{log.products?.name ?? '—'}</div>
                        <div className="text-xs text-slate-400">{log.products?.sku}</div>
                      </td>
                      <td className="px-4 py-3 capitalize">
                        <Badge
                          variant={
                            log.action === 'increase' ? 'success'
                            : log.action === 'decrease' || log.action === 'sale' ? 'warning'
                            : 'default'
                          }
                        >
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={log.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {log.delta > 0 ? '+' : ''}{log.delta}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{log.note ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(log.created_at).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        open={Boolean(adjustProduct)}
        onClose={() => setAdjustProduct(null)}
        title={`Adjust Stock — ${adjustProduct?.name ?? ''}`}
      >
        {adjustProduct && (
          <AdjustForm
            product={adjustProduct}
            shopId={activeShop?.id ?? ''}
            userId={user?.id ?? ''}
            onSuccess={() => {
              setAdjustProduct(null)
              qc.invalidateQueries({ queryKey: ['products', activeShop?.id] })
              qc.invalidateQueries({ queryKey: ['inventory_logs', activeShop?.id] })
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function StockBadge({ product }: { product: Product }) {
  if (product.quantity === 0) return <Badge variant="danger">Out of stock</Badge>
  if (product.quantity <= product.reorder_threshold) return <Badge variant="warning">Low stock</Badge>
  return <Badge variant="success">In stock</Badge>
}

function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant?: 'warning' | 'danger'
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={[
          'mt-1 text-2xl font-semibold',
          variant === 'danger' ? 'text-red-600' : variant === 'warning' ? 'text-amber-600' : '',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  )
}

function AdjustForm({
  product,
  shopId,
  userId,
  onSuccess,
}: {
  product: Product
  shopId: string
  userId: string
  onSuccess: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const form = useForm<InventoryAdjustInput>({
    resolver: zodResolver(InventoryAdjustSchema),
    defaultValues: {
      product_id: product.id,
      action: 'increase',
      delta: 1,
      note: '',
    },
  })

  const action = form.watch('action')

  async function onSubmit(values: InventoryAdjustInput) {
    if (!supabase) return
    setLoading(true)
    setError(null)

    const sign = values.action === 'decrease' ? -1 : 1
    const newQty = values.action === 'adjust'
      ? values.delta
      : product.quantity + sign * values.delta

    const { error: logErr } = await supabase.from('inventory_logs').insert({
      shop_id: shopId,
      product_id: product.id,
      user_id: userId,
      action: values.action,
      delta: values.action === 'decrease' ? -values.delta : values.delta,
      note: values.note || null,
    })

    if (logErr) { setError(logErr.message); setLoading(false); return }

    const { error: updErr } = await supabase
      .from('products')
      .update({ quantity: Math.max(0, newQty) })
      .eq('id', product.id)

    setLoading(false)
    if (updErr) { setError(updErr.message); return }
    onSuccess()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
        <span className="text-slate-500">Current stock:</span>{' '}
        <span className="font-semibold">{product.quantity} units</span>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Action</label>
        <Select {...form.register('action')}>
          <option value="increase">Increase stock (receive / restock)</option>
          <option value="decrease">Decrease stock (damage / correction)</option>
          <option value="adjust">Set exact quantity</option>
        </Select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
          {action === 'adjust' ? 'New Quantity' : 'Units'}
        </label>
        <Input type="number" min="1" {...form.register('delta')} />
        {form.formState.errors.delta && (
          <p className="mt-1 text-xs text-red-600">{form.formState.errors.delta.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
          Note <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <Input placeholder="Reason for adjustment" {...form.register('note')} />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Apply Adjustment'}
        </Button>
      </div>
    </form>
  )
}
