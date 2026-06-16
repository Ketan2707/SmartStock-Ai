import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const STORAGE_KEY = 'cookie_consent'

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) setVisible(true)
  }, [])

  async function respond(accepted: boolean) {
    localStorage.setItem(STORAGE_KEY, accepted ? 'accepted' : 'declined')
    setVisible(false)

    // Store in DB (best-effort, don't block UI)
    if (supabase) {
      const anonymousId = crypto.randomUUID()
      try {
        await supabase.from('cookie_consents').insert({
          anonymous_id: anonymousId,
          consent_given: accepted,
          accepted_at: accepted ? new Date().toISOString() : null,
          declined_at: !accepted ? new Date().toISOString() : null,
        })
      } catch {}
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-6 py-4 shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          We use cookies to improve your experience.{' '}
          <Link to="/cookies" className="underline hover:text-slate-900 dark:hover:text-white">
            Cookie Policy
          </Link>
        </p>
        <div className="flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => respond(false)}
            className="rounded-md border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => respond(true)}
            className="rounded-md bg-slate-900 px-4 py-1.5 text-sm text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
