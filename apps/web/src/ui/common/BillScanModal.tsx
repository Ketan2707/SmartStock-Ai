import { useRef, useState, useCallback, useEffect } from 'react'
import { Camera, Upload, X, RotateCcw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from '../form/Button'
import { Input } from '../form/Input'
import { apiPostForm, apiPost } from '../../lib/api'
import { useShop } from '../../lib/shop'
import { useAuth } from '../../lib/auth'

type ScannedItem = {
  name: string
  quantity: number
  cost_price: number
  sku?: string
  category?: string
  matched_product_id: string | null
  matched_product_name: string | null
  is_new: boolean
}

type ScanResult = {
  ok: boolean
  scan_id: string
  items: ScannedItem[]
}

type Step = 'capture' | 'scanning' | 'review' | 'confirming' | 'done'

export function BillScanModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}) {
  const { activeShop } = useShop()
  const { user } = useAuth()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [step, setStep] = useState<Step>('capture')
  const [camActive, setCamActive] = useState(false)
  const [camError, setCamError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)   // data URL
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [items, setItems] = useState<ScannedItem[]>([])
  const [error, setError] = useState<string | null>(null)

  /* ── cleanup camera on close ── */
  useEffect(() => {
    if (!open) stopCamera()
  }, [open])

  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current

    if (!video || !stream || !camActive || preview) return

    video.srcObject = stream
    void video.play().catch(() => {
      setCamError('Could not start the live camera preview. Try reopening the camera.')
    })
  }, [camActive, preview])

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamActive(false)
  }

  function reset() {
    stopCamera()
    setStep('capture')
    setPreview(null)
    setCapturedBlob(null)
    setScanId(null)
    setItems([])
    setError(null)
    setCamError(null)
  }

  const isReadyToScan = Boolean(capturedBlob && activeShop && user)

  /* ── start live camera ── */
  async function startCamera() {
    setCamError(null)
    if (!window.isSecureContext) {
      setCamError('Camera requires HTTPS. Open the app on https:// (or use localhost in development).')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Camera is not supported in this browser. Try Chrome or Edge, or use file upload instead.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      setCamActive(true)
    } catch {
      setCamError('Camera access denied. Use file upload instead.')
    }
  }

  /* ── snap a frame ── */
  const snapPhoto = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      if (!blob) return
      setCapturedBlob(blob)
      setPreview(canvas.toDataURL('image/jpeg', 0.92))
      stopCamera()
    }, 'image/jpeg', 0.92)
  }, [])

  /* ── file upload ── */
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please upload a JPG, PNG, or WEBP image.')
      e.target.value = ''
      return
    }

    setCapturedBlob(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    stopCamera()
    setError(null)
    // reset input so same file can be re-selected
    e.target.value = ''
  }

  /* ── send to API ── */
  async function scanBill() {
    if (!capturedBlob) return
    if (!activeShop) {
      setError('Select a shop before scanning a bill.')
      return
    }
    if (!user) {
      setError('Please sign in again before using AI Cam.')
      return
    }

    setStep('scanning')
    setError(null)

    const form = new FormData()
    form.append('image', capturedBlob, 'bill.jpg')
    form.append('shop_id', activeShop.id)
    form.append('user_id', user.id)

    try {
      const result = await apiPostForm<ScanResult>('/ai/bill-scan', form)
      setScanId(result.scan_id)
      setItems(result.items)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
      setStep('capture')
    }
  }

  /* ── edit item fields ── */
  function updateItem(idx: number, field: keyof ScannedItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    )
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function addManualItem() {
    setItems((prev) => [
      ...prev,
      {
        name: '',
        quantity: 1,
        cost_price: 0,
        sku: '',
        category: 'Other',
        matched_product_id: null,
        matched_product_name: null,
        is_new: true,
      },
    ])
  }

  /* ── confirm ── */
  async function confirmScan() {
    if (!scanId || !activeShop || !user) return
    setStep('confirming')
    setError(null)

    try {
      await apiPost('/ai/bill-scan/confirm', {
        scan_id: scanId,
        shop_id: activeShop.id,
        user_id: user.id,
        items: items.map((item) => ({
          matched_product_id: item.matched_product_id,
          name: item.name,
          quantity: Number(item.quantity),
          cost_price: Number(item.cost_price),
          sku: item.sku,
          category: item.category,
        })),
      })
      setStep('done')
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm failed')
      setStep('review')
    }
  }

  /* ── render ── */
  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Scan Bill / Invoice"
      maxWidth="max-w-2xl"
    >
      {/* STEP: capture */}
      {step === 'capture' && (
        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Camera view */}
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-black aspect-video dark:border-slate-700">
            {preview ? (
              <img src={preview} alt="Captured bill" className="h-full w-full object-contain" />
            ) : camActive ? (
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-200/80">
                <div className="text-center">
                  <Camera size={40} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Click “Open Camera” or “Upload File”</p>
                  {camError && <p className="mt-2 text-xs text-amber-300">{camError}</p>}
                </div>
              </div>
            )}

            {/* Aim overlay when cam is active */}
            {camActive && !preview && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-3/4 w-3/4 rounded-lg border-2 border-white/60 border-dashed" />
              </div>
            )}

            {/* Retake button */}
            {preview && (
              <button
                type="button"
                onClick={reset}
                className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                aria-label="Retake"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>

          {camError && (
            <p className="text-xs text-amber-600">{camError}</p>
          )}

          {!activeShop && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Select a shop before using AI Cam.
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            {!camActive && !preview && (
              <Button type="button" onClick={startCamera}>
                <Camera size={14} className="mr-1.5" /> Open Camera
              </Button>
            )}

            {camActive && !preview && (
              <Button type="button" onClick={snapPhoto}>
                <Camera size={14} className="mr-1.5" /> Snap Photo
              </Button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Upload size={14} /> Upload File
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onFileChange}
            />

            {preview && (
              <Button type="button" onClick={scanBill} className="ml-auto" disabled={!isReadyToScan}>
                Scan Bill →
              </Button>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Use a clear, straight photo of the bill. Supported formats: JPG, PNG, WEBP.
          </p>

          {/* Hidden canvas for snapshot */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* STEP: scanning */}
      {step === 'scanning' && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <Loader2 size={36} className="animate-spin text-slate-500" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Extracting items from bill…
          </p>
          {preview && (
            <img
              src={preview}
              alt="Bill being scanned"
              className="mt-2 h-32 w-auto rounded border border-slate-200 object-contain opacity-60"
            />
          )}
        </div>
      )}

      {/* STEP: review */}
      {step === 'review' && (
        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <p className="text-sm text-slate-600 dark:text-slate-300">
            Review and edit the extracted items before applying to inventory.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <span>{items.length} item{items.length !== 1 ? 's' : ''} ready to apply</span>
            <button
              type="button"
              onClick={addManualItem}
              className="font-medium text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
            >
              + Add item manually
            </button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              No items could be extracted. Try a clearer photo.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Qty</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Cost (₹)</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">SKU</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Category</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Match</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((item, idx) => (
                    <tr key={idx} className={item.is_new ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}>
                      <td className="px-3 py-2">
                        <input
                          value={item.name}
                          onChange={(e) => updateItem(idx, 'name', e.target.value)}
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                        />
                      </td>
                      <td className="px-3 py-2 w-16">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                        />
                      </td>
                      <td className="px-3 py-2 w-20">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.cost_price}
                          onChange={(e) => updateItem(idx, 'cost_price', Number(e.target.value))}
                          className="px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 min-w-28">
                        <Input
                          value={item.sku ?? ''}
                          onChange={(e) => updateItem(idx, 'sku', e.target.value)}
                          placeholder="Optional"
                          className="px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 min-w-28">
                        <Input
                          value={item.category ?? ''}
                          onChange={(e) => updateItem(idx, 'category', e.target.value)}
                          placeholder="Other"
                          className="px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        {item.is_new ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            New
                          </span>
                        ) : (
                          <span className="text-slate-500 truncate max-w-[80px] block" title={item.matched_product_name ?? ''}>
                            {item.matched_product_name}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="rounded p-1 text-slate-400 hover:text-red-500"
                          aria-label="Remove item"
                        >
                          <X size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={reset}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              ← Rescan
            </button>
            <Button
              type="button"
              onClick={confirmScan}
              disabled={items.length === 0 || items.some((item) => !item.name.trim() || item.quantity < 1)}
            >
              Apply to Inventory ({items.length} items)
            </Button>
          </div>
        </div>
      )}

      {/* STEP: confirming */}
      {step === 'confirming' && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <Loader2 size={36} className="animate-spin text-slate-500" />
          <p className="text-sm text-slate-600 dark:text-slate-300">Updating inventory…</p>
        </div>
      )}

      {/* STEP: done */}
      {step === 'done' && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <CheckCircle size={40} className="text-emerald-500" />
          <p className="text-base font-medium text-slate-800 dark:text-slate-100">
            Inventory updated successfully!
          </p>
          <p className="text-sm text-slate-500">
            {items.length} item{items.length !== 1 ? 's' : ''} applied from the scanned bill.
          </p>
          <Button
            type="button"
            onClick={() => { reset(); onClose() }}
          >
            Done
          </Button>
        </div>
      )}
    </Modal>
  )
}
