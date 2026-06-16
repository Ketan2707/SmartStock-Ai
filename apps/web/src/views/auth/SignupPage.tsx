import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { Button } from '../../ui/form/Button'
import { Input } from '../../ui/form/Input'
import { SetupRequired } from '../SetupRequired'

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormValues = z.infer<typeof schema>

export function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  })

  if (!supabaseConfigured) {
    return <SetupRequired />
  }

  async function onSubmit(values: FormValues) {
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error } = await supabase!.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { name: values.name },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setMessage('Account created. Please check your email to verify before signing in.')
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <div className="text-base font-semibold">Create account</div>
        <div className="text-sm text-slate-600">Email verification is required.</div>
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
          <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
          <Input autoComplete="name" {...form.register('name')} />
          {form.formState.errors.name ? (
            <div className="mt-1 text-xs text-red-600">
              {form.formState.errors.name.message}
            </div>
          ) : null}
        </div>

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
          <Input type="password" autoComplete="new-password" {...form.register('password')} />
          {form.formState.errors.password ? (
            <div className="mt-1 text-xs text-red-600">
              {form.formState.errors.password.message}
            </div>
          ) : null}
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Creating…' : 'Create account'}
        </Button>
      </form>

      <div className="mt-4 text-sm">
        <span className="text-slate-600">Already have an account?</span>{' '}
        <Link to="/login" className="text-slate-700 underline">
          Sign in
        </Link>
      </div>
    </div>
  )
}
