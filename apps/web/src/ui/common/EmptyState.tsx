import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-3 text-slate-300 dark:text-slate-600">{icon}</div>}
      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</div>
      {description && (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
