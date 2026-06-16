import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ChevronDown, ChevronUp, ShoppingCart, Phone, EyeOff } from 'lucide-react'
import type { DemandPrediction, DeadStockItem, SeasonalForecast } from '../../lib/predictions'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useShop } from '../../lib/shop'
import { useQueryClient } from '@tanstack/react-query'

type Insight =
  | { kind: 'demand'; data: DemandPrediction }
  | { kind: 'dead'; data: DeadStockItem }
  | { kind: 'seasonal'; data: SeasonalForecast }

export function InsightsPanel({
  demand, dead, seasonal,
}: {
  demand: DemandPrediction[]
  dead: DeadStockItem[]
  seasonal: SeasonalForecast[]
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [ignored, setIgnored] = useState<Set<string>>(new Set())
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeShop } = useShop()
  const qc = useQueryClient()

  const insights: Insight[] = [
    ...demand.filter((d) => d.urgency === 'high').map((d): Insight => ({ kind: 'demand', data: d })),
    ...demand.filter((d) => d.urgency === 'medium').map((d): Insight => ({ kind: 'demand', data: d })),
    ...dead.map((d): Insight => ({ kind: 'dead', data: d })),
    ...seasonal.map((d): Insight => ({ kind: 'seasonal', data: d })),
  ].filter((ins) => {
    const id = insightId(ins)
    return !ignored.has(id)
  }).slice(0, 10)

  function insightId(ins: Insight) {
    if (ins.kind === 'demand') return `demand-${ins.data.product.id}`
    if (ins.kind === 'dead') return `dead-${ins.data.product.id}`
    return `seasonal-${ins.data.season}-${ins.data.category}`
  }

  function insightLabel(ins: Insight): string {
    if (ins.kind === 'demand') return `${ins.data.product.name} may run out in ${ins.data.daysUntilStockout} days`
    if (ins.kind === 'dead') return `${ins.data.product.name} has had no sales for ${ins.data.daysWithoutSales} days`
    return `${ins.data.season}: demand for ${ins.data.category} up ${Math.round((ins.data.multiplier - 1) * 100)}%`
  }

  function insightUrgency(ins: Insight) {
    if (ins.kind === 'demand') return ins.data.urgency === 'high' ? 'high' : 'medium'
    if (ins.kind === 'dead') return 'low'
    return 'info'
  }

  const urgencyClasses: Record<string, string> = {
    high:   'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    low:    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    info:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  }

  async function generatePO(ins: Insight) {
    if (ins.kind !== 'demand' && ins.kind !== 'dead') return
    if (!supabase || !activeShop || !user) return
    const product = ins.data.product
    const qty = ins.kind === 'demand' ? ins.data.reorderQty : Math.ceil(product.quantity * 0.5)

    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', activeShop.id)
      .ilike('order_number', `PO-${year}-%`)

    const seq = String((count ?? 0) + 1).padStart(3, '0')
    const orderNumber = `PO-${year}-${seq}`

    const { data: po } = await supabase
      .from('purchase_orders')
      .insert({ shop_id: activeShop.id, order_number: orderNumber, status: 'draft', total_value: product.cost_price * qty })
      .select('id').single()

    if (po) {
      await supabase.from('purchase_order_items').insert({
        purchase_order_id: po.id, product_id: product.id, quantity: qty, unit_cost: product.cost_price,
      })
    }
    qc.invalidateQueries({ queryKey: ['purchase_orders', activeShop.id] })
    navigate('/app/purchase-orders')
  }

  async function contactSupplier(ins: Insight) {
    if (ins.kind !== 'demand' && ins.kind !== 'dead') return
    const product = ins.data.product
    const qty = ins.kind === 'demand' ? ins.data.reorderQty : 50

    if (!supabase || !activeShop) return
    const { data: prod } = await supabase
      .from('products').select('default_supplier_id').eq('id', product.id).single()

    if (prod?.default_supplier_id) {
      const { data: supplier } = await supabase
        .from('suppliers').select('email, name').eq('id', prod.default_supplier_id).single()
      if (supplier?.email) {
        const subject = encodeURIComponent(`Restock Request — ${product.name}`)
        const body = encodeURIComponent(`Hi ${supplier.name},\n\nWe need to restock ${product.name}.\nRequested quantity: ${qty} units.\n\nPlease confirm availability.\n\nThank you.`)
        window.open(`mailto:${supplier.email}?subject=${subject}&body=${body}`)
        return
      }
    }
    navigate('/app/suppliers')
  }

  function ignoreInsight(ins: Insight) {
    setIgnored((prev) => new Set([...prev, insightId(ins)]))
  }

  if (insights.length === 0) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <Sparkles size={15} className="text-purple-500" />
        <span className="text-sm font-medium">AI Insights</span>
        <span className="ml-auto rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
          {insights.length} insights
        </span>
      </div>

      <div className="divide-y divide-slate-50 dark:divide-slate-800">
        {insights.map((ins) => {
          const id = insightId(ins)
          const isExpanded = expandedId === id
          const urgency = insightUrgency(ins)
          return (
            <div key={id}>
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <span className={['rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0', urgencyClasses[urgency]].join(' ')}>
                  {urgency === 'high' ? '🔴' : urgency === 'medium' ? '🟡' : urgency === 'info' ? '📅' : '⚪'}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm">{insightLabel(ins)}</span>
                {isExpanded ? <ChevronUp size={14} className="flex-shrink-0 text-slate-400" /> : <ChevronDown size={14} className="flex-shrink-0 text-slate-400" />}
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/30">
                  <div className="flex flex-wrap gap-2">
                    {(ins.kind === 'demand' || ins.kind === 'dead') && (
                      <>
                        <button type="button" onClick={() => generatePO(ins)}
                          className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900">
                          <ShoppingCart size={12} /> Generate PO
                        </button>
                        <button type="button" onClick={() => contactSupplier(ins)}
                          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-white dark:border-slate-700">
                          <Phone size={12} /> Contact Supplier
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => ignoreInsight(ins)}
                      className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-white dark:border-slate-700">
                      <EyeOff size={12} /> Ignore
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
