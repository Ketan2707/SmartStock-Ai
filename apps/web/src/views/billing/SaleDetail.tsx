import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Badge } from '../../ui/common/Badge'
import { Spinner } from '../../ui/common/Spinner'
import type { Sale } from './BillingPage'

type SaleItem = {
  id: string
  product_name: string
  sku: string
  quantity: number
  selling_price: number
  total_price: number
  profit: number
}

export function SaleDetail({ sale, shopName }: { sale: Sale; shopName: string }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['sale_items', sale.id],
    queryFn: async () => {
      if (!supabase) return []
      const { data } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', sale.id)
        .order('product_name')
      return (data ?? []) as SaleItem[]
    },
  })

  function print() {
    window.print()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-mono text-slate-400">Invoice #{sale.id.slice(0, 8).toUpperCase()}</div>
          <div className="mt-0.5 font-semibold">{shopName}</div>
          <div className="text-xs text-slate-500">{new Date(sale.created_at).toLocaleString('en-IN')}</div>
        </div>
        <button
          type="button"
          onClick={print}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <Printer size={12} /> Print
        </button>
      </div>

      {sale.customer_name && (
        <div className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700">
          <div className="text-xs text-slate-500">Customer</div>
          <div className="font-medium">{sale.customer_name}</div>
          {sale.customer_phone && <div className="text-xs text-slate-400">{sale.customer_phone}</div>}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              {['Item', 'Qty', 'Price', 'Total'].map((h) => (
                <th key={h} className="pb-2 text-left text-xs font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-2">
                  <div className="font-medium">{item.product_name}</div>
                  <div className="text-xs text-slate-400">{item.sku}</div>
                </td>
                <td className="py-2 text-slate-600 dark:text-slate-300">{item.quantity}</td>
                <td className="py-2 text-slate-600 dark:text-slate-300">₹{Number(item.selling_price).toFixed(2)}</td>
                <td className="py-2 font-medium">₹{Number(item.total_price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-300">Total Amount</span>
          <span className="font-semibold">₹{Number(sale.total_amount).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Payment</span>
          <span className="capitalize">{sale.payment_method}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Status</span>
          <Badge
            variant={
              sale.status === 'paid' ? 'success'
              : sale.status === 'pending' ? 'warning'
              : 'danger'
            }
          >
            {sale.status}
          </Badge>
        </div>
      </div>
    </div>
  )
}
