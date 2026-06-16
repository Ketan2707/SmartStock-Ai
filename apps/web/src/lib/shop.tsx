import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

export type Shop = {
  id: string
  owner_id: string
  name: string
  type: string
  address: string
  phone: string
  gst_number: string | null
  created_at: string
  updated_at: string
}

type ShopContextValue = {
  shops: Shop[]
  activeShop: Shop | null
  loading: boolean
  setActiveShop: (shop: Shop) => void
  refetch: () => void
}

const ShopContext = createContext<ShopContextValue | null>(null)

export function ShopProvider(props: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [shops, setShops] = useState<Shop[]>([])
  const [activeShop, setActiveShopState] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchShops = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('shops')
      .select('*')
      .order('created_at', { ascending: true })

    const list = (data as Shop[]) ?? []
    setShops(list)

    // restore active shop from settings or pick first
    const { data: settings } = await supabase
      .from('user_settings')
      .select('active_shop_id')
      .eq('user_id', user.id)
      .single()

    const savedId = settings?.active_shop_id
    const active = list.find((s) => s.id === savedId) ?? list[0] ?? null
    setActiveShopState(active)
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchShops()
  }, [fetchShops])

  const setActiveShop = useCallback(
    async (shop: Shop) => {
      setActiveShopState(shop)
      if (!supabase || !user) return
      await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, active_shop_id: shop.id }, { onConflict: 'user_id' })
    },
    [user],
  )

  const value = useMemo<ShopContextValue>(
    () => ({ shops, activeShop, loading, setActiveShop, refetch: fetchShops }),
    [shops, activeShop, loading, setActiveShop, fetchShops],
  )

  return <ShopContext.Provider value={value}>{props.children}</ShopContext.Provider>
}

export function useShop() {
  const ctx = useContext(ShopContext)
  if (!ctx) throw new Error('useShop must be used within ShopProvider')
  return ctx
}
