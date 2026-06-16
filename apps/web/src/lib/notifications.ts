import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useShop } from './shop'
import { useAuth } from './auth'

export type Notification = {
  id: string
  user_id: string
  shop_id: string
  type: 'low_stock' | 'out_of_stock' | 'expiry' | 'ai_recommendation' | 'purchase_order' | 'system'
  title: string
  body: string | null
  read: boolean
  created_at: string
}

export function useNotifications() {
  const { activeShop } = useShop()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['notifications', activeShop?.id],
    queryFn: async () => {
      if (!supabase || !activeShop || !user) return []
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('shop_id', activeShop.id)
        .order('created_at', { ascending: false })
        .limit(50)
      return (data ?? []) as Notification[]
    },
    enabled: Boolean(activeShop && user),
    refetchInterval: 60000,
  })
}

export function useUnreadCount() {
  const { data: notifications = [] } = useNotifications()
  return notifications.filter((n) => !n.read).length
}

export async function createNotification(params: {
  user_id: string
  shop_id: string
  type: Notification['type']
  title: string
  body?: string
}) {
  if (!supabase) return
  await supabase.from('notifications').insert(params)
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  const { activeShop } = useShop()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async () => {
      if (!supabase || !activeShop || !user) return
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('shop_id', activeShop.id)
        .eq('read', false)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', activeShop?.id] }),
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  const { activeShop } = useShop()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) return
      await supabase.from('notifications').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', activeShop?.id] }),
  })
}
