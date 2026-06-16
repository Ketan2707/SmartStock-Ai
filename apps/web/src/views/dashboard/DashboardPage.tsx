import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { AlertTriangle, TrendingUp, Boxes, IndianRupee } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useShop } from '../../lib/shop'
import { Badge } from '../../ui/common/Badge'
import { Spinner } from '../../ui/common/Spinner'
import type { Product } from '../products/ProductsPage'
import type { Sale } from '../billing/BillingPage'

export function DashboardPage() {
  const { activeShop } = useShop()

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products', activeShop?.id],
    queryFn: async () => {
      if (!activeShop || !supabase) return []
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', activeShop.id)
        .order('quantity')
      return (data ?? []) as Product[]
    },
    enabled: Boolean(activeShop),
  })

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales', activeShop?.id],
    queryFn: async () => {
      if (!activeShop || !supabase) return []
      const { data } = await supabase
        .from('sales')
        .select('*')
        .eq('shop_id', activeShop.id)
        .order('created_at', { ascending: false })
        .limit(90)
      return (data ?? []) as Sale[]
    },
    enabled: Boolean(activeShop),
  })

  // KPIs
  const totalProducts = products.length
  const inventoryValue = products.reduce((s, p) => s + p.cost_price * p.quantity, 0)
  const thisMonth = new Date()
  const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1)
  const monthlySales = sales.filter((s) => new Date(s.created_at) >= monthStart)
  const monthlyRevenue = monthlySales.reduce((s, sale) => s + Number(sale.total_amount), 0)
  const monthlyProfit = monthlySales.reduce((s, sale) => s + Number(sale.profit_amount), 0)

  // Low stock
  const lowStock = products.filter((p) => p.quantity > 0 && p.quantity <= p.reorder_threshold)
  const outOfStock = products.filter((p) => p.quantity === 0)

  // Sales chart — last 14 days
  const chartData = buildChartData(sales)

  // Top selling products from sale_items aggregated via sales
  const loading = productsLoading || salesLoading

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {activeShop?.name} — Quick overview of your business.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Products"
          value={loading ? '—' : totalProducts.toString()}
          icon={<Boxes size={18} className="text-slate-400" />}
        />
        <KPICard
          label="Inventory Value"
          value={loading ? '—' : `₹${inventoryValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={<IndianRupee size={18} className="text-slate-400" />}
        />
        <KPICard
          label="Monthly Revenue"
          value={loading ? '—' : `₹${monthlyRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={<TrendingUp size={18} className="text-slate-400" />}
        />
        <KPICard
          label="Monthly Profit"
          value={loading ? '—' : `₹${monthlyProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={<TrendingUp size={18} className="text-emerald-500" />}
          accent="emerald"
        />
      </div>

      {/* Alerts */}
      {(lowStock.length > 0 || outOfStock.length > 0) && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {outOfStock.length > 0 && (
            <AlertCard
              type="danger"
              title={`${outOfStock.length} products out of stock`}
              items={outOfStock.slice(0, 5).map((p) => p.name)}
            />
          )}
          {lowStock.length > 0 && (
            <AlertCard
              type="warning"
              title={`${lowStock.length} products running low`}
              items={lowStock.slice(0, 5).map((p) => `${p.name} (${p.quantity} left)`)}
            />
          )}
        </div>
      )}

      {/* Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 text-sm font-medium">Sales — Last 14 Days</div>
          {salesLoading ? (
            <div className="flex h-48 items-center justify-center"><Spinner /></div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown) => [`₹${Number(v).toFixed(2)}`, 'Revenue']} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0f172a"
                  fill="#f1f5f9"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 text-sm font-medium">Stock Status</div>
          {productsLoading ? (
            <div className="flex h-48 items-center justify-center"><Spinner /></div>
          ) : products.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">
              No products added yet.
            </div>
          ) : (
            <div className="space-y-2">
              {products.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">{p.name}</div>
                  <div className="ml-3 flex items-center gap-2">
                    <span className="text-slate-500 text-xs">{p.quantity} units</span>
                    <Badge
                      variant={
                        p.quantity === 0 ? 'danger'
                        : p.quantity <= p.reorder_threshold ? 'warning'
                        : 'success'
                      }
                    >
                      {p.quantity === 0 ? 'Out' : p.quantity <= p.reorder_threshold ? 'Low' : 'OK'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent sales */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="text-sm font-medium">Recent Sales</div>
        </div>
        {salesLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : sales.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">No sales yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                {['ID', 'Customer', 'Amount', 'Payment', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {sales.slice(0, 8).map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-mono text-xs text-slate-400">{s.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-2">{s.customer_name ?? 'Walk-in'}</td>
                  <td className="px-4 py-2 font-medium">₹{Number(s.total_amount).toFixed(2)}</td>
                  <td className="px-4 py-2 capitalize text-slate-500">{s.payment_method}</td>
                  <td className="px-4 py-2 text-xs text-slate-400">
                    {new Date(s.created_at).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function KPICard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string
  icon: ReactNode
  accent?: 'emerald'
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">{label}</div>
        {icon}
      </div>
      <div
        className={[
          'mt-2 text-xl font-semibold',
          accent === 'emerald' ? 'text-emerald-600' : '',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  )
}

function AlertCard({
  type,
  title,
  items,
}: {
  type: 'warning' | 'danger'
  title: string
  items: string[]
}) {
  const colors =
    type === 'danger'
      ? 'border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10'
      : 'border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10'
  const titleColor = type === 'danger' ? 'text-red-800 dark:text-red-400' : 'text-amber-800 dark:text-amber-400'
  const itemColor = type === 'danger' ? 'text-red-700 dark:text-red-500' : 'text-amber-700 dark:text-amber-500'

  return (
    <div className={['rounded-lg border p-4', colors].join(' ')}>
      <div className={['flex items-center gap-2 text-sm font-medium', titleColor].join(' ')}>
        <AlertTriangle size={15} />
        {title}
      </div>
      <ul className={['mt-2 space-y-0.5 text-xs', itemColor].join(' ')}>
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  )
}

function buildChartData(sales: Sale[]) {
  const days: Record<string, number> = {}
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
    days[key] = 0
  }
  for (const sale of sales) {
    const d = new Date(sale.created_at)
    const key = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
    if (key in days) days[key] += Number(sale.total_amount)
  }
  return Object.entries(days).map(([date, revenue]) => ({ date, revenue }))
}
