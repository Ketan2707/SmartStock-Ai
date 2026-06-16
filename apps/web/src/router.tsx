import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './ui/layout/AppLayout'
import { AuthLayout } from './ui/layout/AuthLayout'
import { RequireAuth } from './ui/auth/RequireAuth'
import { DashboardPage } from './views/dashboard/DashboardPage'
import { LoginPage } from './views/auth/LoginPage'
import { SignupPage } from './views/auth/SignupPage'
import { ForgotPasswordPage } from './views/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './views/auth/ResetPasswordPage'
import { ProductsPage } from './views/products/ProductsPage'
import { InventoryPage } from './views/inventory/InventoryPage'
import { BillingPage } from './views/billing/BillingPage'
import { SettingsPage } from './views/settings/SettingsPage'
import { AIToolsPage } from './views/ai/AIToolsPage'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/app" replace /> },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'billing', element: <BillingPage /> },
      { path: 'ai', element: <AIToolsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
