import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, FileSearch, History, Mic, Sparkles, Wand2 } from 'lucide-react'
import { useShop } from '../../lib/shop'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/form/Button'
import { PageHeader } from '../../ui/common/PageHeader'
import { BillScanModal } from '../../ui/common/BillScanModal'
import { VoiceAssistantModal } from '../../ui/ai/VoiceAssistantModal'
import { EmptyState } from '../../ui/common/EmptyState'
import { Spinner } from '../../ui/common/Spinner'

type VoiceHistoryItem = {
  id: string
  raw_transcript: string
  action_taken: string | null
  created_at: string
  parsed_intent: {
    action?: string
    product_name?: string
    quantity?: number
  } | null
}

export function AIToolsPage() {
  const { activeShop } = useShop()
  const qc = useQueryClient()
  const [scanOpen, setScanOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)

  const { data: voiceHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['voice_logs', activeShop?.id],
    queryFn: async () => {
      if (!activeShop || !supabase) return []
      const { data, error } = await supabase
        .from('voice_logs')
        .select('id, raw_transcript, action_taken, created_at, parsed_intent')
        .eq('shop_id', activeShop.id)
        .order('created_at', { ascending: false })
        .limit(8)

      if (error) throw error
      return (data ?? []) as VoiceHistoryItem[]
    },
    enabled: Boolean(activeShop) && Boolean(supabase),
  })

  return (
    <div className="p-6">
      <PageHeader
        title="AI Tools"
        description="Use AI-powered workflows to speed up billing, inventory updates, and product entry."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ToolCard
          icon={<Camera size={18} className="text-violet-600 dark:text-violet-400" />}
          title="AI Cam"
          description="Scan a supplier bill or invoice, review extracted items, and push them into inventory in one flow."
          badge="Ready"
          action={
            <Button type="button" onClick={() => setScanOpen(true)} disabled={!activeShop}>
              <Camera size={16} className="mr-1.5" /> Open AI Cam
            </Button>
          }
        />

        <ToolCard
          icon={<FileSearch size={18} className="text-slate-500" />}
          title="Smart Bill Parsing"
          description="OCR + AI extraction is built into AI Cam so you can correct names, quantity, SKU, and category before saving."
          badge="Included"
        />

        <ToolCard
          icon={<Mic size={18} className="text-violet-600 dark:text-violet-400" />}
          title="Voice Assistant"
          description="Speak commands like add or remove stock, review the parsed action, and update inventory without typing."
          badge="Ready"
          action={
            <Button type="button" onClick={() => setVoiceOpen(true)} disabled={!activeShop}>
              <Mic size={16} className="mr-1.5" /> Open Voice Assistant
            </Button>
          }
        />

        <ToolCard
          icon={<Wand2 size={18} className="text-slate-500" />}
          title="Inventory AI"
          description="This section is the home for AI workflows, keeping the Inventory page focused on stock tables and history."
          badge="Live"
        />

        <ToolCard
          icon={<Sparkles size={18} className="text-slate-500" />}
          title="More AI Tools"
          description="This space can also hold demand forecasting, dead stock suggestions, and assistant chat as those flows are surfaced in the UI."
          badge="Planned"
        />
      </div>

      {!activeShop && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Select a shop before using AI tools.
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <History size={16} className="text-slate-500" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Voice History</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Latest spoken inventory actions from this shop.
            </p>
          </div>
        </div>

        {!activeShop ? (
          <div className="p-5">
            <EmptyState
              icon={<History size={36} />}
              title="No shop selected"
              description="Select a shop to view recent voice assistant actions."
            />
          </div>
        ) : historyLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : voiceHistory.length === 0 ? (
          <EmptyState
            icon={<History size={36} />}
            title="No voice history yet"
            description="Run a voice command from AI Tools and it will appear here."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {voiceHistory.map((entry) => (
              <div key={entry.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {entry.action_taken ?? summarizeIntent(entry.parsed_intent)}
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      “{entry.raw_transcript}”
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(entry.created_at).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BillScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['products', activeShop?.id] })
          qc.invalidateQueries({ queryKey: ['inventory_logs', activeShop?.id] })
        }}
      />

      <VoiceAssistantModal
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
      />
    </div>
  )
}

function summarizeIntent(intent: VoiceHistoryItem['parsed_intent']) {
  if (!intent?.action || !intent?.product_name || !intent?.quantity) return 'Voice action'
  return `${capitalize(intent.action)} ${intent.quantity} × ${intent.product_name}`
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function ToolCard({
  icon,
  title,
  description,
  badge,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  badge: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">{icon}</div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {badge}
        </span>
      </div>

      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
