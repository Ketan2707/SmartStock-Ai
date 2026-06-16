import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
        <div className="mb-6">
          <div className="text-lg font-semibold">SmartStock AI</div>
          <div className="text-sm text-slate-600">
            Inventory, billing, analytics and demand forecasting.
          </div>
        </div>
        <Outlet />
        <div className="mt-8 text-xs text-slate-500">
          By continuing, you agree to the Terms & Conditions (to be added).
        </div>
      </div>
    </div>
  )
}

