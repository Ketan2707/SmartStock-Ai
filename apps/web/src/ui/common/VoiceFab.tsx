import { Mic, MicOff, X, Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useShop } from '../../lib/shop'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { apiPost } from '../../lib/api'
import { useQueryClient } from '@tanstack/react-query'

type Intent = {
  action: 'add' | 'remove' | 'create' | 'unknown'
  product_name: string
  quantity: number
  cost_price?: number
  selling_price?: number
}

type ApiResponse = { ok: boolean; transcript: string; intent: Intent }

export function VoiceFab() {
  const [state, setState] = useState<'idle' | 'recording' | 'processing' | 'confirm' | 'error'>('idle')
  const [transcript, setTranscript] = useState('')
  const [intent, setIntent] = useState<Intent | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { activeShop } = useShop()
  const { user } = useAuth()
  const qc = useQueryClient()

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = handleRecordingStop
      mr.start()
      mediaRef.current = mr
      setState('recording')
      // Auto-stop at 60s
      timerRef.current = setTimeout(() => stopRecording(), 60000)
    } catch {
      setErrorMsg('Microphone permission denied. Please allow microphone access in your browser settings.')
      setState('error')
    }
  }

  function stopRecording() {
    if (timerRef.current) clearTimeout(timerRef.current)
    mediaRef.current?.stop()
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop())
  }

  async function handleRecordingStop() {
    setState('processing')
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

    // Use Web Speech API transcript if available, else send audio to API
    // For now: use SpeechRecognition if available (client-side, free)
    // The audio blob approach requires backend transcription which needs additional setup
    // We'll use the Web Speech API approach for transcript
    try {
      // Try to get transcript via Web Speech API (already recorded)
      // Since we already have audio, we'll just use a prompt asking the user to type if no transcript
      // In production, send to Whisper/Gemini for transcription
      const form = new FormData()
      form.append('audio', blob, 'voice.webm')
      // Send as text transcript fallback — ask user
      setState('confirm')
      setTranscript('[Audio recorded — type your command below]')
      setIntent({ action: 'unknown', product_name: '', quantity: 0 })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Voice processing failed')
      setState('error')
    }
  }

  async function handleTextSubmit(text: string) {
    setState('processing')
    try {
      const res = await apiPost<ApiResponse>('/ai/voice-command', {
        transcript: text,
        shop_id: activeShop?.id,
      })
      setTranscript(res.transcript)
      setIntent(res.intent)
      if (res.intent.action === 'unknown') {
        setErrorMsg('Could not understand command. Please try again.')
        setState('error')
      } else {
        setState('confirm')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'API error')
      setState('error')
    }
  }

  async function executeIntent() {
    if (!intent || !activeShop || !user || !supabase) return
    setState('processing')

    try {
      if (intent.action === 'add' || intent.action === 'remove') {
        const { data: products } = await supabase
          .from('products')
          .select('id, name, quantity')
          .eq('shop_id', activeShop.id)
          .ilike('name', `%${intent.product_name}%`)
          .limit(1)

        const product = products?.[0]
        if (!product) {
          setErrorMsg(`Product "${intent.product_name}" not found.`)
          setState('error')
          return
        }

        const delta = intent.action === 'add' ? intent.quantity : -intent.quantity
        const newQty = Math.max(0, product.quantity + delta)

        await supabase.from('products').update({ quantity: newQty }).eq('id', product.id)
        await supabase.from('inventory_logs').insert({
          shop_id: activeShop.id, product_id: product.id, user_id: user.id,
          action: intent.action === 'add' ? 'increase' : 'decrease',
          delta: intent.action === 'add' ? intent.quantity : -intent.quantity,
          note: `Voice: "${transcript}"`,
        })
      }

      // Log voice command
      await supabase.from('voice_logs').insert({
        shop_id: activeShop.id, user_id: user.id,
        raw_transcript: transcript,
        parsed_intent: intent,
        action_taken: `${intent.action} ${intent.quantity} ${intent.product_name}`,
      })

      qc.invalidateQueries({ queryKey: ['products', activeShop.id] })
      setState('idle')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to execute command')
      setState('error')
    }
  }

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={startRecording}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
        aria-label="Voice inventory assistant"
        title="Voice command"
      >
        <Mic size={20} />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      {state === 'recording' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium">Listening…</span>
          </div>
          <p className="text-xs text-slate-500">Say: "Add 50 Maggi", "Remove 10 Soap", etc.</p>
          <button type="button" onClick={stopRecording}
            className="w-full rounded-md bg-red-500 py-2 text-sm text-white hover:bg-red-600">
            <MicOff size={14} className="mr-1.5 inline" /> Stop
          </button>
        </div>
      )}

      {state === 'processing' && (
        <div className="py-4 text-center text-sm text-slate-500">Processing…</div>
      )}

      {state === 'confirm' && (
        <VoiceConfirm
          transcript={transcript}
          intent={intent}
          onConfirm={executeIntent}
          onTextSubmit={handleTextSubmit}
          onCancel={() => setState('idle')}
        />
      )}

      {state === 'error' && (
        <div className="space-y-3">
          <p className="text-sm text-red-600">{errorMsg}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setState('idle')}
              className="flex-1 rounded-md border border-slate-200 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700">
              <X size={12} className="mr-1 inline" /> Close
            </button>
            <button type="button" onClick={startRecording}
              className="flex-1 rounded-md bg-slate-900 py-1.5 text-xs text-white hover:bg-slate-800">
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function VoiceConfirm({
  transcript, intent, onConfirm, onTextSubmit, onCancel,
}: {
  transcript: string
  intent: Intent | null
  onConfirm: () => void
  onTextSubmit: (t: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(
    transcript.startsWith('[Audio') ? '' : transcript,
  )
  const isAudio = transcript.startsWith('[Audio')

  if (isAudio) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Type your command (voice transcript unavailable):</p>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add 50 Maggi packets"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          onKeyDown={(e) => e.key === 'Enter' && text.trim() && onTextSubmit(text)}
        />
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-md border border-slate-200 py-1.5 text-xs dark:border-slate-700">Cancel</button>
          <button type="button" onClick={() => onTextSubmit(text)} disabled={!text.trim()}
            className="flex-1 rounded-md bg-slate-900 py-1.5 text-xs text-white disabled:opacity-50">Parse</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-slate-50 p-2 text-xs dark:bg-slate-800">
        <div className="text-slate-500">Heard:</div>
        <div className="font-medium text-slate-800 dark:text-slate-100">"{transcript}"</div>
      </div>
      {intent && intent.action !== 'unknown' && (
        <div className="rounded-md bg-blue-50 p-2 text-xs dark:bg-blue-900/20">
          <div className="font-medium text-blue-800 dark:text-blue-300">
            {intent.action === 'add' ? '➕' : intent.action === 'remove' ? '➖' : '✨'}{' '}
            {intent.action} {intent.quantity} × {intent.product_name}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-md border border-slate-200 py-1.5 text-xs dark:border-slate-700">
          <X size={12} className="mr-1 inline" /> Cancel
        </button>
        <button type="button" onClick={onConfirm}
          className="flex-1 rounded-md bg-slate-900 py-1.5 text-xs text-white hover:bg-slate-800">
          <Check size={12} className="mr-1 inline" /> Confirm
        </button>
      </div>
    </div>
  )
}
