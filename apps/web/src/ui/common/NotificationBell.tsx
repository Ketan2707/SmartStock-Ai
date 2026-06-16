import { Bell, Check, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useNotifications,
  useUnreadCount,
  useMarkAllRead,
  useDeleteNotification,
  type Notification,
} from '../../lib/notifications'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useShop } from '../../lib/shop'

const TYPE_ROUTES: Record<string, string> = {
  low_stock: '/app/inventory',
  out_of_stock: '/app/inventory',
  expiry: '/app/inventory',
  ai_recommendation: '/app',
  purchase_order: '/app/purchase-orders',
  system: '/app',
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { data: notifications = [] } = useNotifications()
  const unread = useUnreadCount()
  const markAll = useMarkAllRead()
  const deleteNotif = useDeleteNotification()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { activeShop } = useShop()

  async function handleClick(n: Notification) {
    if (!n.read && supabase) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      qc.invalidateQueries({ queryKey: ['notifications', activeShop?.id] })
    }
    navigate(TYPE_ROUTES[n.type] ?? '/app')
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-40 w-80 rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <span className="text-sm font-medium">Notifications</span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  <Check size={12} /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">No notifications yet.</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={[
                      'flex items-start gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-800',
                      !n.read ? 'bg-slate-50 dark:bg-slate-800/50' : '',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => handleClick(n)}
                    >
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-100">{n.title}</div>
                      {n.body && <div className="mt-0.5 text-xs text-slate-500">{n.body}</div>}
                      <div className="mt-1 text-[10px] text-slate-400">
                        {new Date(n.created_at).toLocaleString('en-IN')}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNotif.mutate(n.id)}
                      className="mt-0.5 text-slate-300 hover:text-red-500"
                      aria-label="Delete notification"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { navigate('/app/notifications'); setOpen(false) }}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                View all notifications →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
