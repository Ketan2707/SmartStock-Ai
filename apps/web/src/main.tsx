import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import './styles/tailwind.css'
import { router } from './router'
import { AuthProvider } from './lib/auth'
import { ShopProvider } from './lib/shop'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ShopProvider>
          <RouterProvider router={router} />
        </ShopProvider>
      </QueryClientProvider>
    </AuthProvider>
  </React.StrictMode>,
)
