import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Boxes } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useShop } from '../../lib/shop'
import { Button } from '../../ui/form/Button'
import { Input } from '../../ui/form/Input'
import { Badge } from '../../ui/common/Badge'
import { Modal } from '../../ui/common/Modal'
import { Spinner } from '../../ui/common/Spinner'
import { EmptyState } from '../../ui/common/EmptyState'
import { PageHeader } from '../../ui/common/PageHeader'
import { ProductForm } from './ProductForm'

export type Product = {
  id: string
  shop_id: string
  name: string
  sku: string
  category: string
  brand: string | null
  cost_price: number
  selling_price: number
  quantity: number
  reorder_threshold: number
  expiry_date: string | null
  created_at: string
}

export function ProductsPage() {
  const { activeShop } = useShop()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', activeShop?.id],
    queryFn: async () => {
      if (!activeShop || !supabase) return []
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', activeShop.id)
        .order('name')
      if (error) throw error
      return data as Product[]
    },
    enabled: Boolean(activeShop),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Not configured')
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products', activeShop?.id] }),
  })

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()),
  )

  function stockVariant(p: Product) {
    if (p.quantity === 0) return 'danger'
    if (p.quantity <= p.reorder_threshold) return 'warning'
    return 'success'
  }

  function stockLabel(p: Product) {
    if (p.quantity === 0) return 'Out of stock'
    if (p.quantity <= p.reorder_threshold) return 'Low stock'
    return 'In stock'
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Products"
        description="Manage your product catalog and stock levels."
        action={
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={16} className="mr-1.5" /> Add Product
          </Button>
        }
      />

      <div className="mt-5 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-8"
            placeholder="Search by name, SKU, category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-slate-500">{filtered.length} products</span>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Boxes size={40} />}
            title={search ? 'No products match your search' : 'No products yet'}
            description={search ? 'Try a different search term.' : 'Add your first product to get started.'}
            action={
              !search ? (
                <Button onClick={() => setAddOpen(true)}>
                  <Plus size={16} className="mr-1.5" /> Add Product
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  {['Name', 'SKU', 'Category', 'Stock', 'Cost', 'Selling', 'Status', ''].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div>{p.name}</div>
                      {p.brand && (
                        <div className="text-xs text-slate-400">{p.brand}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.category}</td>
                    <td className="px-4 py-3 font-medium">{p.quantity}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">₹{p.cost_price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">₹{p.selling_price.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={stockVariant(p)}>{stockLabel(p)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditProduct(p)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
                          aria-label="Edit product"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete "${p.name}"?`)) deleteMutation.mutate(p.id)
                          }}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          aria-label="Delete product"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Product">
        <ProductForm
          shopId={activeShop?.id ?? ''}
          onSuccess={() => {
            setAddOpen(false)
            qc.invalidateQueries({ queryKey: ['products', activeShop?.id] })
          }}
        />
      </Modal>

      <Modal open={Boolean(editProduct)} onClose={() => setEditProduct(null)} title="Edit Product">
        {editProduct && (
          <ProductForm
            shopId={activeShop?.id ?? ''}
            product={editProduct}
            onSuccess={() => {
              setEditProduct(null)
              qc.invalidateQueries({ queryKey: ['products', activeShop?.id] })
            }}
          />
        )}
      </Modal>
    </div>
  )
}
