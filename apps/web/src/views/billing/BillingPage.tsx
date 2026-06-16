import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, FileText, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useShop } from '../../lib/shop'
import { Button } from '../../ui/form/Button'
import { Badge } from '../../ui/common/Badge'
import { Modal } from '../../ui/common/Modal'
import { Spinner } from '../../ui/common/Spinner'
import { EmptyState } from '../../ui/common/EmptyState'
import { PageHeader } from '../../ui/common/PageHeader'
import { NewSaleForm } from './NewSaleForm'
import { SaleDetail } from './SaleDetail'

export type Sale = {
  id: string
  shop_id: string
  user_id: string
  customer_name: string | null
  customer_phone: string | null
  total_amount: number
  profit_amount: number
  payment_method: string
  status: string
  notes: string | null
  created_at: string
}

export function BillingPage() {
  const { activeShop } = useShop()
  const qc = useQueryClient()
  const [newOpen, setNewOpen] = useState(false)
  const [viewSale, setViewSale] = useState<Sale | null>(null)

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', activeShop?.id],
    queryFn: async () => {
      if (!activeShop || !supabase) return []
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('shop_id', activeShop.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Sale[]
    },
    enabled: Boolean(activeShop),
  })

  const totalRevenue = sales.reduce((s, sale) => s + Number(sale.total_amount), 0)
  const totalProfit = sales.reduce((s, sale) => s + Number(sale.profit_amount), 0)

  return (
    <div className="p-6">
      <PageHeader
        title="Billing"
        description="Create sales invoices and track transaction history."
        action={
          <Button onClick={() => setNewOpen(true)}>
            <Plus size={16} className="mr-1.5" /> New Sale
          </Button>
        }
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Sales" value={sales.length.toString()} />
        <StatCard label="Total Revenue" value={`₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
        <StatCard label="Total Profit" value={`₹${totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} variant="success" />
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : sales.length === 0 ? (
          <EmptyState
            icon={<FileText size={40} />}
            title="No sales yet"
            description="Create your first sale to start tracking revenue."
            action={
              <Button onClick={() => setNewOpen(true)}>
                <Plus size={16} className="mr-1.5" /> New Sale
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  {['Invoice', 'Customer', 'Amount', 'Profit', 'Payment', 'Status', 'Date', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {sale.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      {sale.customer_name ?? <span className="text-slate-400">Walk-in</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      ₹{Number(sale.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">
                      ₹{Number(sale.profit_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">
                      {sale.payment_method}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          sale.status === 'paid' ? 'success'
                          : sale.status === 'pending' ? 'warning'
                          : 'danger'
                        }
                      >
                        {sale.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(sale.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setViewSale(sale)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
                        aria-label="View sale"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New Sale" maxWidth="max-w-2xl">
        <NewSaleForm
          shopId={activeShop?.id ?? ''}
          shopName={activeShop?.name ?? ''}
          onSuccess={() => {
            setNewOpen(false)
            qc.invalidateQueries({ queryKey: ['sales', activeShop?.id] })
            qc.invalidateQueries({ queryKey: ['products', activeShop?.id] })
          }}
        />
      </Modal>

      <Modal
        open={Boolean(viewSale)}
        onClose={() => setViewSale(null)}
        title="Sale Details"
        maxWidth="max-w-xl"
      >
        {viewSale && <SaleDetail sale={viewSale} shopName={activeShop?.name ?? ''} />}
      </Modal>
    </div>
  )
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string
  value: string
  variant?: 'success'
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={['mt-1 text-xl font-semibold', variant === 'success' ? 'text-emerald-600' : ''].join(' ')}>
        {value}
      </div>
    </div>
  )
}
