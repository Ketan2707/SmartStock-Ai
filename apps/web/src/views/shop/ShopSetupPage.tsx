import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ShopCreateSchema, type ShopCreateInput } from '@smartstock/shared'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useShop } from '../../lib/shop'
import { Button } from '../../ui/form/Button'
import { Input } from '../../ui/form/Input'
import { Select } from '../../ui/form/Select'

const SHOP_TYPES = [
  { value: 'retail', label: 'Retail Store' },
  { value: 'grocery', label: 'Grocery Shop' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'vendor', label: 'Vendor / Supplier' },
  { value: 'other', label: 'Other' },
]

export function ShopSetupPage() {
  const { user } = useAuth()
  const { refetch } = useShop()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const form = useForm<ShopCreateInput>({
    resolver: zodResolver(ShopCreateSchema),
    defaultValues: { name: '', type: 'retail', address: '', phone: '', gst_number: '' },
  })

  async function onSubmit(values: ShopCreateInput) {
    if (!supabase || !user) return
    setLoading(true)
    setError(null)

    const { error: err } = await supabase.from('shops').insert({
      ...values,
      owner_id: user.id,
      gst_number: values.gst_number || null,
    })

    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    refetch()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="text-xl font-semibold">Set up your shop</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Create your first shop to start managing inventory and billing.
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Shop Name *
            </label>
            <Input placeholder="e.g. Sharma General Store" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Shop Type *
            </label>
            <Select {...form.register('type')}>
              {SHOP_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Address *
            </label>
            <Input placeholder="Shop address" {...form.register('address')} />
            {form.formState.errors.address && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.address.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Phone Number *
            </label>
            <Input placeholder="e.g. 9876543210" {...form.register('phone')} />
            {form.formState.errors.phone && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.phone.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              GST Number{' '}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <Input placeholder="e.g. 22AAAAA0000A1Z5" {...form.register('gst_number')} />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Creating shop…' : 'Create shop & continue'}
          </Button>
        </form>
      </div>
    </div>
  )
}
