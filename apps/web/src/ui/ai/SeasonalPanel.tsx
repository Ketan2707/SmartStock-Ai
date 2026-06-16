import { Sun } from 'lucide-react'
import type { SeasonalForecast } from '../../lib/predictions'

export function SeasonalPanel({ forecasts }: { forecasts: SeasonalForecast[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <Sun size={15} className="text-yellow-500" />
        <span className="text-sm font-medium">Seasonal Trends</span>
      </div>

      {forecasts.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400">
          No active seasonal trends right now. Check back closer to Summer, Diwali, or other peak seasons.
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-slate-800">
          {forecasts.map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{f.season}</div>
                <div className="text-xs text-slate-500">{f.recommendation}</div>
              </div>
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                +{Math.round((f.multiplier - 1) * 100)}% demand
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
