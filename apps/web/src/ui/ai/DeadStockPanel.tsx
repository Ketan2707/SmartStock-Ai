import { Archive } from 'lucide-react'
import type { DeadStockItem } from '../../lib/predictions'

export function DeadStockPanel({ items }: { items: DeadStockItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <Archive size={15} className="text-slate-400" />
        <span className="text-sm font-medium">Dead Stock</span>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          {items.length} products
        </span>
      </div>
      <div className="divide-y divide-slate-50 dark:divide-slate-800">
        {items.map(({ product, lastSaleDate, daysWithoutSales, valueAtCost, recommendation }) => (
          <div key={product.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{product.name}</div>
                <div className="text-xs text-slate-500">
                  {product.quantity} units · ₹{valueAtCost.toFixed(0)} tied up ·{' '}
                  {lastSaleDate
                    ? `Last sold ${daysWithoutSales}d ago`
                    : 'Never sold'}
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex-shrink-0">
                {recommendation}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
