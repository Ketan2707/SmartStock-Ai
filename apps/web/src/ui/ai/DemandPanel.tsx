import { TrendingDown } from 'lucide-react'
import type { DemandPrediction } from '../../lib/predictions'

export function DemandPanel({ predictions }: { predictions: DemandPrediction[] }) {
  if (predictions.length === 0) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <TrendingDown size={15} className="text-amber-500" />
        <span className="text-sm font-medium">Stock-Out Predictions</span>
        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          {predictions.length} products
        </span>
      </div>
      <div className="divide-y divide-slate-50 dark:divide-slate-800">
        {predictions.map(({ product, avgDailyRate, daysUntilStockout, stockoutDate, reorderQty, urgency }) => (
          <div key={product.id} className="flex items-center gap-3 px-4 py-3">
            <div
              className={[
                'h-2 w-2 rounded-full flex-shrink-0',
                urgency === 'high' ? 'bg-red-500' : 'bg-amber-400',
              ].join(' ')}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{product.name}</div>
              <div className="text-xs text-slate-500">
                {product.quantity} in stock · {avgDailyRate.toFixed(1)}/day avg
              </div>
            </div>
            <div className="text-right">
              <div className={['text-sm font-semibold', urgency === 'high' ? 'text-red-600' : 'text-amber-600'].join(' ')}>
                {daysUntilStockout}d left
              </div>
              <div className="text-xs text-slate-400">
                {stockoutDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              </div>
            </div>
            <div className="text-right text-xs text-slate-500 w-20">
              Order {reorderQty}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
