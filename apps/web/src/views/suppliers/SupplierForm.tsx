import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { SupplierSchema, type SupplierInput } from '@smartstock/shared'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/form/Button'
import { Input } from '../../ui/form/Input'
import { Textarea } from '../../ui/form/Textarea'
import type { Supplier } from './SuppliersPage'

export function SupplierForm({
  shopId, supplier, onSuccess,
}: { shopId: string; supplier?: Supplier; onSuccess: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isEdit = Boolean(supplier)

  const form = useForm<SupplierInput>({
    resolver: zodResolver(SupplierSchema),
    defaultValues: supplier
      ? { name: supplier.name, contact_name: supplier.contact_name ?? '', phone: supplier.phone ?? '', email: supplier.email ?? '', address: supplier.address ?? '', notes: supplier.notes ?? '' }
      : { name: '', contact_name: '', phone: '', email: '', address: '', notes: '' },
  })

  async function onSubmit(values: SupplierInput) {
    if (!supabase) return
    setLoading(true); setError(null)
    const payload = { ...values, shop_id: shopId, email: values.email || null, contact_name: values.contact_name || null, phone: values.phone || null, address: values.address || null, notes: values.notes || null }
    const { error: err } = isEdit
      ? await supabase.from('suppliers').update(payload).eq('id', supplier!.id)
      : await supabase.from('suppliers').insert(payload)
    setLoading(false)
    if (err) { setError(err.message); return }
    onSuccess()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Supplier Name *</label>
        <Input placeholder="e.g. Nestlé India Distributor" {...form.register('name')} />
        {form.formState.errors.name && <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Contact Person</label>
          <Input placeholder="Name" {...form.register('contact_name')} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Phone</label>
          <Input placeholder="9876543210" {...form.register('phone')} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Email</label>
        <Input type="email" placeholder="supplier@email.com" {...form.register('email')} />
        {form.formState.errors.email && <p className="mt-1 text-xs text-red-600">{form.formState.errors.email.message}</p>}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Address</label>
        <Input placeholder="Address" {...form.register('address')} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Notes</label>
        <Textarea rows={2} placeholder="Any notes..." {...form.register('notes')} />
      </div>
      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={loading}>{loading ? 'Saving…' : isEdit ? 'Update Supplier' : 'Add Supplier'}</Button>
      </div>
    </form>
  )
}
