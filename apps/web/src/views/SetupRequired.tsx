export function SetupRequired() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="font-semibold">Supabase is not configured</div>
      <div className="mt-1 text-amber-800">
        Set these frontend environment variables locally or in Vercel:
      </div>
      <pre className="mt-2 overflow-auto rounded-md border border-amber-200 bg-white p-3 text-xs text-slate-900">
        {`VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key`}
      </pre>
      <div className="mt-2 text-amber-800">If you are running locally, restart the dev server after adding them.</div>
    </div>
  )
}
