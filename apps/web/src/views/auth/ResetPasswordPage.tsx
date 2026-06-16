import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Button } from '../../ui/form/Button'
import { Input } from '../../ui/form/Input'
import { SetupRequired } from '../SetupRequired'

const schema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormValues = z.infer<typeof schema>

export function ResetPasswordPage() {
  const { session } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '' },
  })

  if (!supabaseConfigured) {
    return <SetupRequired />
  }

  async function onSubmit(values: FormValues) {
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error } = await supabase!.auth.updateUser({ password: values.password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }
    setMessage('Password updated. You can now sign in.')
  }

  if (!session) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-base font-semibold">Open the reset link</div>
        <div className="mt-2 text-sm text-slate-600">
          Please open this page using the password reset link from your email.
        </div>
        <div className="mt-4 text-sm">
          <Link to="/login" className="text-slate-700 underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <div className="text-base font-semibold">Choose a new password</div>
        <div className="text-sm text-slate-600">This will update your account password.</div>
      </div>

      {error ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            New password
          </label>
          <Input type="password" autoComplete="new-password" {...form.register('password')} />
          {form.formState.errors.password ? (
            <div className="mt-1 text-xs text-red-600">
              {form.formState.errors.password.message}
            </div>
          ) : null}
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Updating…' : 'Update password'}
        </Button>
      </form>

      <div className="mt-4 text-sm">
        <Link to="/login" className="text-slate-700 underline">
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
