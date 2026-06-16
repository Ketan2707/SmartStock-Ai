import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { supabaseConfigured } from '../../lib/supabase'
import { Button } from '../../ui/form/Button'
import { Input } from '../../ui/form/Input'
import { SetupRequired } from '../SetupRequired'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: string } | null)?.from ?? '/app'

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  if (!supabaseConfigured) {
    return <SetupRequired />
  }

  async function onSubmit(values: FormValues) {
    setLoading(true)
    setError(null)
    const { error } = await supabase!.auth.signInWithPassword(values)
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate(from, { replace: true })
  }

  async function oauth(provider: 'google' | 'github') {
    setError(null)
    const { error } = await supabase!.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/app` },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <div className="text-base font-semibold">Sign in</div>
        <div className="text-sm text-slate-600">Use your email and password.</div>
      </div>

      {error ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
          <Input type="email" autoComplete="email" {...form.register('email')} />
          {form.formState.errors.email ? (
            <div className="mt-1 text-xs text-red-600">
              {form.formState.errors.email.message}
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Password</label>
          <Input type="password" autoComplete="current-password" {...form.register('password')} />
          {form.formState.errors.password ? (
            <div className="mt-1 text-xs text-red-600">
              {form.formState.errors.password.message}
            </div>
          ) : null}
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link to="/forgot-password" className="text-slate-700 underline">
          Forgot password?
        </Link>
        <Link to="/signup" className="text-slate-700 underline">
          Create account
        </Link>
      </div>

      <div className="my-4 h-px bg-slate-200" />

      <div className="space-y-2">
        <button
          type="button"
          className="w-full rounded-md border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          onClick={() => oauth('google')}
        >
          Continue with Google
        </button>
        <button
          type="button"
          className="w-full rounded-md border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          onClick={() => oauth('github')}
        >
          Continue with GitHub
        </button>
      </div>
    </div>
  )
}
