import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useShop } from '../../lib/shop'
import { Button } from '../../ui/form/Button'
import { Input } from '../../ui/form/Input'
import { Select } from '../../ui/form/Select'
import { PageHeader } from '../../ui/common/PageHeader'
import { ShopCreateSchema, type ShopCreateInput } from '@smartstock/shared'

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name is required'),
})
type ProfileInput = z.infer<typeof profileSchema>

const passwordSchema = z
  .object({
    password: z.string().min(6, 'At least 6 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })
type PasswordInput = z.infer<typeof passwordSchema>

const SHOP_TYPES = [
  { value: 'retail', label: 'Retail Store' },
  { value: 'grocery', label: 'Grocery Shop' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'vendor', label: 'Vendor / Supplier' },
  { value: 'other', label: 'Other' },
]

export function SettingsPage() {
  const { user } = useAuth()
  const { shops, activeShop, setActiveShop, refetch } = useShop()
  const [tab, setTab] = useState<'profile' | 'shop' | 'security'>('profile')

  return (
    <div className="p-6">
      <PageHeader title="Settings" description="Manage your account and shop settings." />

      <div className="mt-5 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {(['profile', 'shop', 'security'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              'px-4 py-2 text-sm font-medium capitalize',
              tab === t
                ? 'border-b-2 border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            ].join(' ')}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6 max-w-lg">
        {tab === 'profile' && <ProfileTab user={user} />}
        {tab === 'shop' && (
          <ShopTab
            shops={shops}
            activeShop={activeShop}
            setActiveShop={setActiveShop}
            refetch={refetch}
          />
        )}
        {tab === 'security' && <SecurityTab />}
      </div>
    </div>
  )
}

function ProfileTab({ user }: { user: ReturnType<typeof useAuth>['user'] }) {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: user?.user_metadata?.name ?? '' },
  })

  async function onSubmit(values: ProfileInput) {
    if (!supabase || !user) return
    setLoading(true)
    setError(null)
    setSuccess(false)

    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: values.full_name })
      .eq('id', user.id)

    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess(true)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-sm font-semibold">Profile</h2>

      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Profile updated.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Full Name</label>
        <Input {...form.register('full_name')} />
        {form.formState.errors.full_name && (
          <p className="mt-1 text-xs text-red-600">{form.formState.errors.full_name.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Email</label>
        <Input value={user?.email ?? ''} disabled className="opacity-60" />
        <p className="mt-1 text-xs text-slate-400">Email cannot be changed here.</p>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Save Profile'}
      </Button>
    </form>
  )
}

function ShopTab({
  shops,
  activeShop,
  setActiveShop,
  refetch,
}: {
  shops: ReturnType<typeof useShop>['shops']
  activeShop: ReturnType<typeof useShop>['activeShop']
  setActiveShop: ReturnType<typeof useShop>['setActiveShop']
  refetch: () => void
}) {
  const [editMode, setEditMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const form = useForm<ShopCreateInput>({
    resolver: zodResolver(ShopCreateSchema),
    values: activeShop
      ? {
          name: activeShop.name,
          type: activeShop.type as ShopCreateInput['type'],
          address: activeShop.address,
          phone: activeShop.phone,
          gst_number: activeShop.gst_number ?? '',
        }
      : undefined,
  })

  async function onSave(values: ShopCreateInput) {
    if (!supabase || !activeShop) return
    setLoading(true)
    setError(null)
    setSuccess(false)

    const { error: err } = await supabase
      .from('shops')
      .update({ ...values, gst_number: values.gst_number || null })
      .eq('id', activeShop.id)

    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess(true)
    setEditMode(false)
    refetch()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Shop Settings</h2>
        {shops.length > 1 && (
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span>Active:</span>
            <select
              value={activeShop?.id ?? ''}
              onChange={(e) => {
                const s = shops.find((sh) => sh.id === e.target.value)
                if (s) setActiveShop(s)
              }}
              className="rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Shop updated.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={form.handleSubmit(onSave)} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Shop Name</label>
          <Input {...form.register('name')} disabled={!editMode} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Shop Type</label>
          <Select {...form.register('type')} disabled={!editMode}>
            {SHOP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Address</label>
          <Input {...form.register('address')} disabled={!editMode} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Phone</label>
            <Input {...form.register('phone')} disabled={!editMode} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">GST Number</label>
            <Input {...form.register('gst_number')} disabled={!editMode} />
          </div>
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</Button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </>
          ) : (
            <Button type="button" onClick={() => setEditMode(true)}>Edit Shop</Button>
          )}
        </div>
      </form>
    </div>
  )
}

function SecurityTab() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm<PasswordInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirm: '' },
  })

  async function onSubmit(values: PasswordInput) {
    if (!supabase) return
    setLoading(true)
    setError(null)
    setSuccess(false)

    const { error: err } = await supabase.auth.updateUser({ password: values.password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess(true)
    form.reset()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-sm font-semibold">Change Password</h2>

      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Password updated successfully.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">New Password</label>
        <Input type="password" {...form.register('password')} />
        {form.formState.errors.password && (
          <p className="mt-1 text-xs text-red-600">{form.formState.errors.password.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Confirm Password</label>
        <Input type="password" {...form.register('confirm')} />
        {form.formState.errors.confirm && (
          <p className="mt-1 text-xs text-red-600">{form.formState.errors.confirm.message}</p>
        )}
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Updating…' : 'Update Password'}
      </Button>
    </form>
  )
}
