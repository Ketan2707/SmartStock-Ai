import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Loader2, Mic, MicOff, PackagePlus, Trash2 } from 'lucide-react'
import { Modal } from '../common/Modal'
import { Button } from '../form/Button'
import { apiPost } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useShop } from '../../lib/shop'

type VoiceIntent = {
  action: 'add' | 'remove' | 'create' | 'unknown'
  product_name: string
  quantity: number
  cost_price?: number
  selling_price?: number
}

type VoiceCommandResponse = {
  ok: boolean
  transcript: string
  intent: VoiceIntent
}

type ProductMetadataResponse = {
  ok: boolean
  metadata: {
    sku: string
    category: string
    brand: string
    reorder_threshold: number
  }
}

type ProductRow = {
  id: string
  name: string
  quantity: number
  cost_price: number
  selling_price: number
  sku: string
  category: string
}

type VoiceState = 'idle' | 'listening' | 'parsing' | 'confirm' | 'executing' | 'success' | 'error'

type SpeechRecognitionAlternativeLike = {
  transcript: string
}

type SpeechRecognitionResultLike = {
  isFinal: boolean
  0: SpeechRecognitionAlternativeLike
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionErrorEventLike = {
  error: string
}

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }
}

export function VoiceAssistantModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { activeShop } = useShop()
  const { user } = useAuth()
  const qc = useQueryClient()

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const transcriptRef = useRef('')
  const ignoreEndRef = useRef(false)

  const [state, setState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [intent, setIntent] = useState<VoiceIntent | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!open) {
      cleanupRecognition(true)
      resetState()
    }

    return () => cleanupRecognition(true)
  }, [open])

  function resetState() {
    setState('idle')
    setTranscript('')
    setIntent(null)
    setError('')
    setSuccessMessage('')
    transcriptRef.current = ''
  }

  function cleanupRecognition(abort = false) {
    if (!recognitionRef.current) return
    ignoreEndRef.current = abort
    if (abort) recognitionRef.current.abort()
    else recognitionRef.current.stop()
    recognitionRef.current = null
  }

  function getRecognitionCtor() {
    return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
  }

  async function startListening() {
    if (!activeShop) {
      setError('Select a shop before using voice assistant.')
      setState('error')
      return
    }

    if (!user || !supabase) {
      setError('Please sign in again before using voice assistant.')
      setState('error')
      return
    }

    const RecognitionCtor = getRecognitionCtor()
    if (!RecognitionCtor) {
      setError('Voice recognition is not supported in this browser. Try Chrome or Edge.')
      setState('error')
      return
    }

    cleanupRecognition(true)
    transcriptRef.current = ''
    setTranscript('')
    setIntent(null)
    setError('')
    setSuccessMessage('')
    setState('listening')
    ignoreEndRef.current = false

    const recognition = new RecognitionCtor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-IN'
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let finalText = transcriptRef.current
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) finalText += `${text} `
        else interimText += text
      }

      transcriptRef.current = finalText
      setTranscript(`${finalText}${interimText}`.trim())
    }

    recognition.onerror = (event) => {
      ignoreEndRef.current = true
      recognitionRef.current = null
      setError(mapRecognitionError(event.error))
      setState('error')
    }

    recognition.onend = () => {
      recognitionRef.current = null

      if (ignoreEndRef.current) {
        ignoreEndRef.current = false
        return
      }

      const spokenText = transcriptRef.current.trim()
      if (!spokenText) {
        setError('No speech detected. Try again and speak clearly.')
        setState('error')
        return
      }

      void parseTranscript(spokenText)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  function stopListening() {
    if (!recognitionRef.current) return
    cleanupRecognition(false)
  }

  async function parseTranscript(spokenText: string) {
    setState('parsing')
    setTranscript(spokenText)
    setError('')

    try {
      const response = await apiPost<VoiceCommandResponse>('/ai/voice-command', {
        transcript: spokenText,
        shop_id: activeShop?.id,
      })

      setTranscript(response.transcript)
      setIntent(response.intent)

      if (response.intent.action === 'unknown' || !response.intent.product_name || response.intent.quantity < 1) {
        setError('Could not understand the command. Try saying: "Add 10 Maggi" or "Remove 2 soap".')
        setState('error')
        return
      }

      setState('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice command parsing failed.')
      setState('error')
    }
  }

  async function executeIntent() {
    if (!intent || !activeShop || !user || !supabase) return

    setState('executing')
    setError('')

    try {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('id, name, quantity, cost_price, selling_price, sku, category')
        .eq('shop_id', activeShop.id)
        .order('name')

      if (fetchError) throw fetchError

      const products = (data ?? []) as ProductRow[]
      const matchedProduct = findBestProductMatch(products, intent.product_name)
      let actionTaken = ''

      if (intent.action === 'remove') {
        if (!matchedProduct) {
          throw new Error(`Product "${intent.product_name}" was not found in inventory.`)
        }

        const newQty = Math.max(0, matchedProduct.quantity - intent.quantity)
        const { error: updateError } = await supabase
          .from('products')
          .update({ quantity: newQty })
          .eq('id', matchedProduct.id)

        if (updateError) throw updateError

        const { error: logError } = await supabase.from('inventory_logs').insert({
          shop_id: activeShop.id,
          product_id: matchedProduct.id,
          user_id: user.id,
          action: 'decrease',
          delta: -intent.quantity,
          note: `Voice assistant: "${transcript}"`,
        })

        if (logError) throw logError

        actionTaken = `Removed ${intent.quantity} units from ${matchedProduct.name}.`
      } else if (intent.action === 'add' && matchedProduct) {
        const payload: Record<string, number> = {
          quantity: matchedProduct.quantity + intent.quantity,
        }

        if (typeof intent.cost_price === 'number') payload.cost_price = intent.cost_price
        if (typeof intent.selling_price === 'number') payload.selling_price = intent.selling_price

        const { error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', matchedProduct.id)

        if (updateError) throw updateError

        const { error: logError } = await supabase.from('inventory_logs').insert({
          shop_id: activeShop.id,
          product_id: matchedProduct.id,
          user_id: user.id,
          action: 'increase',
          delta: intent.quantity,
          note: `Voice assistant: "${transcript}"`,
        })

        if (logError) throw logError

        actionTaken = `Added ${intent.quantity} units to ${matchedProduct.name}.`
      } else {
        const metadata = await getProductMetadata(intent.product_name, activeShop.type)
        const sku = metadata?.sku ?? generateSku(intent.product_name)
        const category = metadata?.category ?? 'Other'
        const brand = metadata?.brand?.trim() ? metadata.brand : null
        const reorderThreshold = metadata?.reorder_threshold ?? 10
        const costPrice = intent.cost_price ?? 0
        const sellingPrice = intent.selling_price ?? (costPrice > 0 ? Number((costPrice * 1.2).toFixed(2)) : 0)

        const { data: createdProduct, error: insertError } = await supabase
          .from('products')
          .insert({
            shop_id: activeShop.id,
            name: intent.product_name,
            sku,
            category,
            brand,
            cost_price: costPrice,
            selling_price: sellingPrice,
            quantity: intent.quantity,
            reorder_threshold: reorderThreshold,
          })
          .select('id, name')
          .single()

        if (insertError || !createdProduct) throw insertError ?? new Error('Failed to create product.')

        const { error: logError } = await supabase.from('inventory_logs').insert({
          shop_id: activeShop.id,
          product_id: createdProduct.id,
          user_id: user.id,
          action: 'increase',
          delta: intent.quantity,
          note: `Voice assistant: "${transcript}"`,
        })

        if (logError) throw logError

        actionTaken = `Created ${createdProduct.name} and added ${intent.quantity} units.`
      }

      await supabase.from('voice_logs').insert({
        shop_id: activeShop.id,
        user_id: user.id,
        raw_transcript: transcript,
        parsed_intent: intent,
        action_taken: actionTaken,
      })

      qc.invalidateQueries({ queryKey: ['products', activeShop.id] })
      qc.invalidateQueries({ queryKey: ['inventory_logs', activeShop.id] })
      qc.invalidateQueries({ queryKey: ['voice_logs', activeShop.id] })

      setSuccessMessage(actionTaken)
      setState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute voice command.')
      setState('error')
    }
  }

  const ready = Boolean(activeShop && user && supabase)
  const icon =
    intent?.action === 'remove' ? <Trash2 size={16} className="text-red-500" />
    : <PackagePlus size={16} className="text-emerald-500" />

  return (
    <Modal open={open} onClose={onClose} title="Voice Assistant" maxWidth="max-w-xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Speak a stock command and confirm the action. Examples: `Add 10 Maggi`, `Remove 2 Lux soap`, `Create new product Dairy Milk quantity 20 cost 40 selling 50`.
        </p>

        {!ready && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Select a shop and make sure you are signed in before using voice assistant.
          </div>
        )}

        {state === 'idle' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-slate-900 p-3 text-white dark:bg-slate-100 dark:text-slate-900">
                <Mic size={18} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Hands-free stock update</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Start listening, say the command clearly, then confirm the parsed result.
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="button" onClick={startListening} disabled={!ready}>
                <Mic size={16} className="mr-1.5" /> Start Listening
              </Button>
            </div>
          </div>
        )}

        {state === 'listening' && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-900/40 dark:bg-violet-900/10">
            <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium">Listening…</span>
            </div>
            <div className="mt-3 min-h-16 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-violet-900/40 dark:bg-slate-900 dark:text-slate-200">
              {transcript || 'Speak now…'}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={stopListening}
                className="inline-flex items-center rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
              >
                <MicOff size={16} className="mr-1.5" /> Stop
              </button>
            </div>
          </div>
        )}

        {(state === 'parsing' || state === 'executing') && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 size={28} className="animate-spin" />
            <span>{state === 'parsing' ? 'Understanding your command…' : 'Updating inventory…'}</span>
          </div>
        )}

        {state === 'confirm' && intent && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="text-xs uppercase tracking-wide text-slate-400">Transcript</div>
              <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">"{transcript}"</div>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {icon}
                {intent.action === 'remove'
                  ? `Remove ${intent.quantity} units from ${intent.product_name}`
                  : intent.action === 'create'
                    ? `Create ${intent.product_name} with ${intent.quantity} units`
                    : `Add ${intent.quantity} units to ${intent.product_name}`}
              </div>
              {(typeof intent.cost_price === 'number' || typeof intent.selling_price === 'number') && (
                <div className="mt-2 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                  {typeof intent.cost_price === 'number' && <span>Cost: ₹{intent.cost_price}</span>}
                  {typeof intent.cost_price === 'number' && typeof intent.selling_price === 'number' && <span> • </span>}
                  {typeof intent.selling_price === 'number' && <span>Selling: ₹{intent.selling_price}</span>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={startListening}
                className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
              >
                Listen again
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetState()
                    onClose()
                  }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <Button type="button" onClick={executeIntent}>
                  Confirm Action
                </Button>
              </div>
            </div>
          </div>
        )}

        {state === 'success' && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <div className="text-base font-medium text-slate-900 dark:text-slate-100">Voice command completed</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">{successMessage}</div>
            </div>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={startListening}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Run another command
              </button>
              <Button
                type="button"
                onClick={() => {
                  resetState()
                  onClose()
                }}
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-4">
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <div>{error}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  resetState()
                  onClose()
                }}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <Button type="button" onClick={startListening} disabled={!ready}>
                Try Again
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findBestProductMatch(products: ProductRow[], query: string) {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return null

  return (
    products.find((product) => normalizeText(product.name) === normalizedQuery) ??
    products.find((product) => normalizeText(product.name).includes(normalizedQuery)) ??
    products.find((product) => normalizedQuery.includes(normalizeText(product.name))) ??
    null
  )
}

function mapRecognitionError(error: string) {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'Microphone permission was denied. Allow microphone access in your browser and try again.'
  }
  if (error === 'no-speech') return 'No speech was detected. Try again and speak clearly.'
  if (error === 'audio-capture') return 'No microphone was found. Check your device audio settings.'
  return 'Voice recognition failed. Try again.'
}

function generateSku(productName: string) {
  const prefix = productName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')
  const suffix = Date.now().toString().slice(-4)
  return `${prefix}-${suffix}`
}

async function getProductMetadata(productName: string, shopType: string) {
  try {
    const response = await apiPost<ProductMetadataResponse>('/ai/product-metadata', {
      product_name: productName,
      shop_type: shopType,
    })
    return response.metadata
  } catch {
    return null
  }
}
