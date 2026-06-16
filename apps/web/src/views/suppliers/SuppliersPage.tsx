import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Edit2, Trash2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useShop } from '../../lib/shop'
import { Button } from '../../ui/form/Button'
import { Modal } from '../../ui/common/Modal'
import { EmptyState } from '../../ui/common/EmptyState'
import { Spinner } from '../../ui/common/Spinner'
import { PageHeader } from '../../ui/common/PageHeader'
import { SupplierForm } from './SupplierForm'

export type Supplier = {
  id: string
  shop_id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export function SuppliersPage() {
  const { activeShop } = useShop()
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', activeShop?.id],
    queryFn: async () => {
      if (!activeShop || !supabase) return []
      const { data } = await supabase
        .from('suppliers').select('*').eq('shop_id', activeShop.id).order('name')
      return (data ?? []) as Supplier[]
    },
    enabled: Boolean(activeShop),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Not configured')
      // Set supplier_id to null on purchase_orders before delete
      await supabase.from('purchase_orders').update({ supplier_id: null }).eq('supplier_id', id)
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers', activeShop?.id] }),
  })

  return (
    <div className="p-6">
      <PageHeader title="Suppliers" description="Manage your suppliers and purchase contacts."
        action={<Button onClick={() => setAddOpen(true)}><Plus size={16} className="mr-1.5" />Add Supplier</Button>} />

      <div className="mt-5 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : suppliers.length === 0 ? (
          <EmptyState icon={<Users size={40} />} title="No suppliers yet"
            description="Add suppliers to track where you source your products."
            action={<Button onClick={() => setAddOpen(true)}><Plus size={16} className="mr-1.5" />Add Supplier</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  {['Name','Contact','Phone','Email',''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.contact_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setEditSupplier(s)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                          <Edit2 size={14} />
                        </button>
                        <button type="button"
                          onClick={() => { if (confirm(`Delete "${s.name}"?`)) deleteMutation.mutate(s.id) }}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Supplier">
        <SupplierForm shopId={activeShop?.id ?? ''} onSuccess={() => { setAddOpen(false); qc.invalidateQueries({ queryKey: ['suppliers', activeShop?.id] }) }} />
      </Modal>
      <Modal open={Boolean(editSupplier)} onClose={() => setEditSupplier(null)} title="Edit Supplier">
        {editSupplier && <SupplierForm shopId={activeShop?.id ?? ''} supplier={editSupplier}
          onSuccess={() => { setEditSupplier(null); qc.invalidateQueries({ queryKey: ['suppliers', activeShop?.id] }) }} />}
      </Modal>
    </div>
  )
}
