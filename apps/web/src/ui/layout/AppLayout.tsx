import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  ChevronDown,
  Menu,
  FileText,
  Home,
  Settings,
  Sparkles,
  Store,
  X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useShop } from '../../lib/shop'
import { ThemeToggle } from './ThemeToggle'
import { ShopSetupPage } from '../../views/shop/ShopSetupPage'
import { Spinner } from '../common/Spinner'

const navItems = [
  { to: '/app', label: 'Dashboard', icon: Home, end: true },
  { to: '/app/products', label: 'Products', icon: Boxes },
  { to: '/app/inventory', label: 'Inventory', icon: BarChart3 },
  { to: '/app/billing', label: 'Billing', icon: FileText },
  { to: '/app/ai', label: 'AI Tools', icon: Sparkles },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export function AppLayout() {
  const { user } = useAuth()
  const { shops, activeShop, setActiveShop, loading: shopLoading } = useShop()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!mobileNavOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileNavOpen])

  // Show setup if no shops yet
  if (shopLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spinner size={28} />
      </div>
    )
  }

  if (!shopLoading && shops.length === 0) {
    return <ShopSetupPage />
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex lg:flex-col">
          <SidebarContent
            userEmail={user?.email ?? ''}
            shops={shops}
            activeShopId={activeShop?.id ?? ''}
            activeShopName={activeShop?.name ?? ''}
            onChangeShop={(shopId) => {
              const shop = shops.find((item) => item.id === shopId)
              if (shop) setActiveShop(shop)
            }}
          />
        </aside>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              aria-hidden="true"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <SidebarContent
                userEmail={user?.email ?? ''}
                shops={shops}
                activeShopId={activeShop?.id ?? ''}
                activeShopName={activeShop?.name ?? ''}
                closeOnNavigate={() => setMobileNavOpen(false)}
                headerAction={
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="Close navigation"
                  >
                    <X size={18} />
                  </button>
                }
                onChangeShop={(shopId) => {
                  const shop = shops.find((item) => item.id === shopId)
                  if (shop) setActiveShop(shop)
                }}
              />
            </aside>
          </div>
        )}

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu size={18} />
              </button>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {activeShop?.name ?? 'SmartStock AI'}
                </div>
                <div className="truncate text-xs text-slate-400 capitalize">
                  {activeShop?.type} shop
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-auto">
            <Outlet />
          </main>

          <footer className="border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
            © {new Date().getFullYear()} SmartStock AI
          </footer>
        </div>
      </div>
    </div>
  )
}

function SidebarContent({
  userEmail,
  shops,
  activeShopId,
  activeShopName,
  onChangeShop,
  closeOnNavigate,
  headerAction,
}: {
  userEmail: string
  shops: Array<{ id: string; name: string }>
  activeShopId: string
  activeShopName: string
  onChangeShop: (shopId: string) => void
  closeOnNavigate?: () => void
  headerAction?: ReactNode
}) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 dark:bg-slate-100">
            <Store size={14} className="text-white dark:text-slate-900" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">SmartStock AI</div>
            <div className="mt-0.5 text-xs text-slate-500">Inventory Intelligence</div>
          </div>
        </div>
        {headerAction}
      </div>

      {shops.length > 0 && (
        <div className="border-b border-slate-100 px-3 py-3 dark:border-slate-800">
          <div className="mb-1 px-1 text-xs text-slate-400">Current Shop</div>
          {shops.length === 1 ? (
            <div className="rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
              {activeShopName}
            </div>
          ) : (
            <div className="relative">
              <select
                value={activeShopId}
                onChange={(e) => onChangeShop(e.target.value)}
                className="w-full appearance-none rounded-md border border-slate-200 bg-white py-1.5 pl-2 pr-7 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>{shop.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={closeOnNavigate}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm',
                  isActive
                    ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-50'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50',
                ].join(' ')
              }
            >
              <Icon size={16} />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-slate-100 px-3 py-3 dark:border-slate-800">
        <div className="truncate text-xs text-slate-500">{userEmail}</div>
        <button
          type="button"
          className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          disabled={!supabaseConfigured}
          onClick={() => {
            closeOnNavigate?.()
            supabase?.auth.signOut()
          }}
        >
          Sign out
        </button>
      </div>
    </>
  )
}
