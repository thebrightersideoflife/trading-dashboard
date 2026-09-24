import { useState, useRef, useEffect } from 'react'
import { UploadCloud, FileImage, X, Trash2, RotateCcw } from 'lucide-react'
import { supabase } from '../../api/supabaseClient'
import { parseBrokerDate } from '../../utils/parseDate'
import { getCurrencySymbol } from '../../utils/formatters'
import LoadingScreen from '../common/LoadingScreen'

const GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    trades: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          broker_trade_id: { type: 'string', description: 'The ID column value, as a string' },
          symbol: { type: 'string' },
          side: { type: 'string', enum: ['Buy', 'Sell'] },
          open_date_raw: { type: 'string', description: 'Exactly as printed, e.g. 06.08.26 10:24' },
          close_date_raw: { type: 'string', description: 'Exactly as printed, e.g. 06.08.26 10:30' },
          entry_price: { type: 'number' },
          exit_price: { type: 'number' },
          quantity: { type: 'number' },
          fees: { type: 'number' },
          realized_pnl: { type: 'number' },
          status: { type: 'string' },
        },
        required: [
          'symbol',
          'side',
          'open_date_raw',
          'close_date_raw',
          'entry_price',
          'exit_price',
          'quantity',
          'fees',
          'realized_pnl',
        ],
      },
    },
  },
  required: ['trades'],
}

const CANDIDATE_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.5-flash',
]

const PROMPT_TEXT =
  'Extract every row from this trade history table into the given JSON schema. ' +
  'Read every field exactly as printed. Do not invent, round, or guess any value. ' +
  'Dates in broker tables are printed as Day.Month.Year Hour:Minute (DD.MM.YY HH:mm, e.g. 06.08.26 10:24 is Day=06, Month=08, Year=26) — copy them exactly as printed into open_date_raw / close_date_raw without reformatting. ' +
  'If a value is genuinely not visible for a row, omit that field rather than guessing.'

const LOADING_MESSAGES = [
  'Reading image file…',
  'Analyzing closed-trades table…',
  'Extracting trade rows via Gemini AI…',
  'Processing prices & timestamps…',
  'Just a moment, almost there…',
  'Finalizing trade extraction…',
  'Still processing, hang tight…',
]

async function callGeminiDirectWithFallbackAndRetry(apiKey, imageBase64, mimeType, onStatusUpdate) {
  let lastError = null

  if (apiKey.startsWith('AQ.')) {
    throw new Error(
      'Invalid GEMINI_API_KEY format. Keys starting with "AQ." are Google Cloud OAuth tokens, not Google AI Studio keys. ' +
      'Please get a free Google AI Studio API key (starts with "AIza...") from https://aistudio.google.com/app/apikey ' +
      'and set GEMINI_API_KEY=AIza... in your .env file.'
    )
  }

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (onStatusUpdate) {
          onStatusUpdate(`Extracting trades with Gemini AI (${model})…`)
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: PROMPT_TEXT },
                    { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: GEMINI_SCHEMA,
              },
            }),
          }
        )

        const errData = await res.json().catch(() => ({}))

        if (res.ok) {
          const text = errData?.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            const cleaned = text.replace(/```json|```/g, '').trim()
            return JSON.parse(cleaned)
          }
        }

        const msg = errData?.error?.message || `HTTP ${res.status}`
        lastError = msg

        if (res.status === 400 || res.status === 401 || res.status === 403) {
          throw new Error(
            `Gemini API Key Error (${res.status}): Please check GEMINI_API_KEY in .env. ` +
            `Make sure it is a valid Google AI Studio key starting with "AIza..." (from https://aistudio.google.com/app/apikey). ${msg}`
          )
        }

        if (res.status === 429 || res.status === 503) {
          console.warn(`[Gemini API 429/503 for ${model}] Rate limit reached. Trying fallback model...`)
          if (onStatusUpdate) {
            onStatusUpdate(`Rate limit reached on ${model}, trying alternate model…`)
          }
          break
        }

        if (res.status === 404) {
          console.warn(`[Gemini API 404 for ${model}] Model not found. Trying next candidate model...`)
          break
        }

        await new Promise((r) => setTimeout(r, 1000))
      } catch (err) {
        if (err.message?.includes('Gemini API Key Error') || err.message?.includes('Invalid GEMINI_API_KEY')) throw err
        lastError = err.message
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
  }

  if (lastError && (lastError.includes('Quota exceeded') || lastError.includes('429'))) {
    throw new Error('Gemini API free tier rate limit reached. Please wait ~30 seconds before uploading another screenshot.')
  }

  throw new Error(lastError || 'Gemini API is temporarily busy. Please wait a few seconds and try again.')
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      const base64 = result.split(',')[1]
      resolve({ base64, mimeType: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ImportTradesModal({ onClose, onTradesSaved }) {
  const [status, setStatus] = useState('Idle')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [extractedTrades, setExtractedTrades] = useState([])
  const [errorMsg, setErrorMsg] = useState(null)
  const [themeColor, setThemeColor] = useState('var(--accent-lime)')
  const [currency, setCurrency] = useState('USD')
  const fileInputRef = useRef(null)

  const currencySymbol = getCurrencySymbol(currency)

  // Calculate summary metrics for extracted trades
  const totalFees = extractedTrades.reduce((s, t) => s + Number(t.fees || 0), 0)
  const winCount = extractedTrades.filter((t) => Number(t.realized_pnl || 0) > 0).length
  const totalPnl = extractedTrades.reduce((s, t) => s + Number(t.realized_pnl || 0), 0)

  // Fetch user's chosen theme_color and currency from Supabase profile
  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('theme_color, currency')
          .maybeSingle()
        if (profile?.theme_color) {
          setThemeColor(profile.theme_color)
        }
        if (profile?.currency) {
          setCurrency(profile.currency)
        }
      } catch (err) {
        console.warn('Could not load profile settings:', err)
      }
    }
    fetchUserProfile()
  }, [])

  // Dynamic message progression while loading
  useEffect(() => {
    if (!loading) return

    let step = 0
    setStatus(LOADING_MESSAGES[0])

    const interval = setInterval(() => {
      step++
      if (step < LOADING_MESSAGES.length) {
        setStatus(LOADING_MESSAGES[step])
      }
    }, 3500)

    return () => clearInterval(interval)
  }, [loading])

  const processExtraction = async (file) => {
    if (!file) return
    setErrorMsg(null)
    setLoading(true)

    try {
      const { base64, mimeType } = await fileToBase64(file)

      let rawTrades = []

      // 1. Primary: Serverless endpoint `/api/extract` (uses backend GEMINI_API_KEY)
      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data?.trades) rawTrades = data.trades
        } else {
          const errData = await res.json().catch(() => ({}))
          console.warn('/api/extract returned non-200:', errData)
          if (errData?.detail?.includes('Gemini API Key Error')) {
            throw new Error(errData.detail)
          }
        }
      } catch (err) {
        if (err.message?.includes('Gemini API Key Error')) throw err
        console.warn('Could not connect to /api/extract serverless function:', err)
      }

      // 2. Fallback for local Vite dev server without Vercel CLI runner
      if (!rawTrades.length) {
        const keyToUse = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY
        if (!keyToUse) {
          throw new Error(
            'GEMINI_API_KEY is missing. Please set GEMINI_API_KEY in .env file or Vercel environment variables.'
          )
        }

        const parsed = await callGeminiDirectWithFallbackAndRetry(keyToUse, base64, mimeType, (st) => setStatus(st))
        rawTrades = parsed.trades || []
      }

      // Normalize extracted trades
      const normalized = rawTrades.map((t, idx) => {
        const openParsed = parseBrokerDate(t.open_date_raw)
        const closeParsed = parseBrokerDate(t.close_date_raw)

        return {
          id: `ext-${Date.now()}-${idx}`,
          broker_trade_id: t.broker_trade_id || null,
          symbol: t.symbol || 'UNKNOWN',
          side: t.side === 'Sell' ? 'Sell' : 'Buy',
          open_time: openParsed,
          close_time: closeParsed,
          open_raw: t.open_date_raw,
          close_raw: t.close_date_raw,
          entry_price: t.entry_price ?? 0,
          exit_price: t.exit_price ?? 0,
          quantity: t.quantity ?? 0.01,
          fees: t.fees ?? 0,
          swap: 0,
          realized_pnl: t.realized_pnl ?? 0,
        }
      })

      setExtractedTrades(normalized)
      setStatus(`Successfully extracted ${normalized.length} trades. Review below, then save.`)
    } catch (err) {
      console.error('[ImportTradesModal] Extraction Error:', err)
      setErrorMsg(err.message || 'Failed to extract trades from screenshot.')
      setStatus('Extraction failed')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) processExtraction(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) processExtraction(file)
  }

  const handleTradeChange = (index, field, value) => {
    setExtractedTrades((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const removeTrade = (index) => {
    setExtractedTrades((prev) => prev.filter((_, i) => i !== index))
  }

  // Save extracted trades conforming 100% to public.trades database schema
  const handleSaveAll = async () => {
    if (!extractedTrades.length) return
    setSaving(true)
    setErrorMsg(null)
    setStatus('Saving trades to database…')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        throw new Error('User session not found. Please log in to save trades.')
      }

      const payload = extractedTrades.map((t) => {
        const openTime = t.open_time || new Date().toISOString()
        const closeTime = t.close_time || new Date().toISOString()
        const entryPrice = Math.max(0.00001, Number(t.entry_price) || 0.00001)
        const exitPrice = Math.max(0.00001, Number(t.exit_price) || 0.00001)
        const quantity = Math.max(0.00001, Number(t.quantity) || 0.01)

        return {
          user_id: user.id,
          symbol: t.symbol || 'NAS100',
          side: t.side === 'Sell' ? 'Sell' : 'Buy',
          open_time: openTime,
          close_time: closeTime,
          entry_price: entryPrice,
          exit_price: exitPrice,
          quantity: quantity,
          fees: Number(t.fees) || 0,
          swap: Number(t.swap) || 0,
          realized_pnl: Number(t.realized_pnl) || 0,
          is_mock: false,
        }
      })

      const { error } = await supabase.from('trades').insert(payload)
      if (error) throw error

      setStatus(`Saved ${payload.length} trades!`)
      if (onTradesSaved) onTradesSaved()
      onClose()
    } catch (err) {
      console.error('[ImportTradesModal] Save error:', err)
      setErrorMsg(`Save failed: ${err.message}`)
      setStatus('Save error')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    background: 'var(--bg-main, #0d0d12)',
    border: '1px solid var(--border-color, #232334)',
    borderRadius: '6px',
    color: 'var(--text-main, #fff)',
    fontSize: '0.82rem',
    padding: '6px 8px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card, #12121a)',
          border: '1px solid var(--border-color, #232334)',
          borderRadius: '16px',
          padding: '28px',
          width: '100%',
          maxWidth: '1120px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--card-shadow, 0 10px 30px rgba(0,0,0,0.5))',
          color: 'var(--text-main, #fff)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border-color, #232334)',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileImage size={22} style={{ color: themeColor }} />
              Import Trades from Broker Screenshot
            </h2>
            <p style={{ color: 'var(--text-muted, #8b8b9e)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
              AI extracts trade rows automatically using Gemini Vision. Review before saving.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #8b8b9e)',
              fontSize: '1.25rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '6px',
              borderRadius: '6px',
              opacity: loading ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>

          {/* 1. Loading State Card */}
          {loading ? (
            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.01)',
                border: '1px solid var(--border-color, #232334)',
                borderRadius: '16px',
                margin: '12px 0 20px 0',
                overflow: 'hidden',
              }}
            >
              <LoadingScreen message={status} inline={true} />
            </div>
          ) : extractedTrades.length === 0 ? (
            /* 2. Upload Drag & Drop Area */
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-color, #232334)',
                borderRadius: '14px',
                padding: '42px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: 'rgba(255,255,255,0.01)',
                transition: 'border-color 0.2s, background-color 0.2s',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = themeColor
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color, #232334)'
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color, #232334)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px',
                  color: themeColor,
                }}
              >
                <UploadCloud size={28} />
              </div>
              <div style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '6px' }}>
                Drag & drop broker screenshot or click to upload
              </div>
              <div style={{ color: 'var(--text-muted, #8b8b9e)', fontSize: '0.82rem' }}>
                Supports MetaTrader, cTrader, TradingView, or broker history screenshots (PNG, JPG, WEBP)
              </div>
            </div>
          ) : (
            /* 3. Extracted Trades Summary Header & Actions */
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '0.98rem', fontWeight: '700' }}>
                  Extracted Trades ({extractedTrades.length})
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '10px' }}>
                  Review prices, dates, and P&L in {currency} ({currencySymbol}) before saving.
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setExtractedTrades([]); setStatus('Idle'); setErrorMsg(null); }}
                style={{
                  background: 'none',
                  border: `1px solid var(--border-color)`,
                  borderRadius: '6px',
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'inherit',
                }}
              >
                <RotateCcw size={14} />
                Upload Another Screenshot
              </button>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div
              style={{
                color: 'var(--color-loss, #f03e3e)',
                fontSize: '0.82rem',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(240,62,62,0.1)',
                border: '1px solid var(--color-loss, #f03e3e)',
                marginBottom: '16px',
              }}
            >
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Extracted Trades Review Table matching the Trades Table database schema */}
          {!loading && extractedTrades.length > 0 && (
            <div
              style={{
                overflowX: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-main, #0d0d12)',
              }}
            >
              <table style={{ width: '100%', minWidth: '1060px', borderCollapse: 'collapse', fontSize: '0.82rem', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '90px' }} />  {/* ID */}
                  <col style={{ width: '100px' }} /> {/* Symbol */}
                  <col style={{ width: '76px' }} />  {/* Side */}
                  <col style={{ width: '155px' }} /> {/* Open Date */}
                  <col style={{ width: '155px' }} /> {/* Close Date */}
                  <col style={{ width: '110px' }} /> {/* Entry */}
                  <col style={{ width: '110px' }} /> {/* Exit */}
                  <col style={{ width: '65px' }} />  {/* Qty */}
                  <col style={{ width: '70px' }} />  {/* Fee */}
                  <col style={{ width: '105px' }} /> {/* P&L */}
                  <col style={{ width: '80px' }} />  {/* Status */}
                  <col style={{ width: '40px' }} />  {/* Action */}
                </colgroup>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 10px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.74rem', textTransform: 'uppercase' }}>ID</th>
                    <th style={{ padding: '12px 10px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.74rem', textTransform: 'uppercase' }}>Symbol</th>
                    <th style={{ padding: '12px 10px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.74rem', textTransform: 'uppercase' }}>Side</th>
                    <th style={{ padding: '12px 10px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.74rem', textTransform: 'uppercase' }}>Open Date</th>
                    <th style={{ padding: '12px 10px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.74rem', textTransform: 'uppercase' }}>Close Date</th>
                    <th style={{ padding: '12px 10px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.74rem', textTransform: 'uppercase' }}>Entry</th>
                    <th style={{ padding: '12px 10px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.74rem', textTransform: 'uppercase' }}>Exit</th>
                    <th style={{ padding: '12px 10px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.74rem', textTransform: 'uppercase' }}>Qty</th>
                    <th style={{ padding: '12px 10px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.74rem', textTransform: 'uppercase' }}>Fee</th>
                    <th style={{ padding: '12px 10px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.74rem', textTransform: 'uppercase' }}>P&L</th>
                    <th style={{ padding: '12px 10px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.74rem', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 10px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {extractedTrades.map((t, idx) => {
                    const pnl = Number(t.realized_pnl) || 0
                    const isWin = pnl >= 0

                    return (
                      <tr key={t.id || idx} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.12s' }}>
                        {/* ID */}
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                          {t.broker_trade_id || `#${idx + 1}`}
                        </td>

                        {/* Symbol */}
                        <td style={{ padding: '8px 8px' }}>
                          <input
                            style={{ ...inputStyle, fontWeight: '700' }}
                            value={t.symbol}
                            onChange={(e) => handleTradeChange(idx, 'symbol', e.target.value)}
                          />
                        </td>

                        {/* Side Badge */}
                        <td style={{ padding: '8px 8px' }}>
                          <select
                            style={{
                              ...inputStyle,
                              fontWeight: '700',
                              backgroundColor: t.side === 'Buy' ? 'rgba(37,211,102,0.1)' : 'rgba(240,62,62,0.1)',
                              color: t.side === 'Buy' ? themeColor : 'var(--color-loss)',
                              borderColor: t.side === 'Buy' ? 'rgba(37,211,102,0.3)' : 'rgba(240,62,62,0.3)',
                              borderRadius: '6px',
                            }}
                            value={t.side}
                            onChange={(e) => handleTradeChange(idx, 'side', e.target.value)}
                          >
                            <option value="Buy">Buy</option>
                            <option value="Sell">Sell</option>
                          </select>
                        </td>

                        {/* Open Time */}
                        <td style={{ padding: '8px 8px' }}>
                          <input
                            type="datetime-local"
                            style={{
                              ...inputStyle,
                              borderColor: !t.open_time ? 'var(--color-loss)' : 'var(--border-color)',
                              colorScheme: 'dark',
                            }}
                            value={t.open_time ? t.open_time.slice(0, 16) : ''}
                            onChange={(e) => handleTradeChange(idx, 'open_time', e.target.value ? new Date(e.target.value).toISOString() : null)}
                          />
                          {!t.open_time && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-loss)', marginTop: '2px' }}>
                              Raw: {t.open_raw || '—'}
                            </div>
                          )}
                        </td>

                        {/* Close Time */}
                        <td style={{ padding: '8px 8px' }}>
                          <input
                            type="datetime-local"
                            style={{
                              ...inputStyle,
                              borderColor: !t.close_time ? 'var(--color-loss)' : 'var(--border-color)',
                              colorScheme: 'dark',
                            }}
                            value={t.close_time ? t.close_time.slice(0, 16) : ''}
                            onChange={(e) => handleTradeChange(idx, 'close_time', e.target.value ? new Date(e.target.value).toISOString() : null)}
                          />
                          {!t.close_time && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-loss)', marginTop: '2px' }}>
                              Raw: {t.close_raw || '—'}
                            </div>
                          )}
                        </td>

                        {/* Entry Price */}
                        <td style={{ padding: '8px 8px' }}>
                          <input
                            type="number"
                            step="any"
                            style={inputStyle}
                            value={t.entry_price}
                            onChange={(e) => handleTradeChange(idx, 'entry_price', e.target.value)}
                          />
                        </td>

                        {/* Exit Price */}
                        <td style={{ padding: '8px 8px' }}>
                          <input
                            type="number"
                            step="any"
                            style={inputStyle}
                            value={t.exit_price}
                            onChange={(e) => handleTradeChange(idx, 'exit_price', e.target.value)}
                          />
                        </td>

                        {/* Qty */}
                        <td style={{ padding: '8px 8px' }}>
                          <input
                            type="number"
                            step="any"
                            style={inputStyle}
                            value={t.quantity}
                            onChange={(e) => handleTradeChange(idx, 'quantity', e.target.value)}
                          />
                        </td>

                        {/* Fee */}
                        <td style={{ padding: '8px 8px' }}>
                          <input
                            type="number"
                            step="any"
                            style={inputStyle}
                            value={t.fees}
                            onChange={(e) => handleTradeChange(idx, 'fees', e.target.value)}
                          />
                        </td>

                        {/* P&L */}
                        <td style={{ padding: '8px 8px' }}>
                          <input
                            type="number"
                            step="any"
                            style={{
                              ...inputStyle,
                              fontWeight: '700',
                              color: isWin ? themeColor : 'var(--color-loss)',
                            }}
                            value={t.realized_pnl}
                            onChange={(e) => handleTradeChange(idx, 'realized_pnl', e.target.value)}
                          />
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: '8px 8px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              backgroundColor: isWin ? 'rgba(37,211,102,0.12)' : 'rgba(240,62,62,0.12)',
                              color: isWin ? themeColor : 'var(--color-loss)',
                              border: `1px solid ${isWin ? 'rgba(37,211,102,0.3)' : 'rgba(240,62,62,0.3)'}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isWin ? '↑ Win' : '↓ Loss'}
                          </span>
                        </td>

                        {/* Delete Action */}
                        <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => removeTrade(idx)}
                            title="Remove row"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.12s, background 0.12s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--color-loss)'
                              e.currentTarget.style.backgroundColor = 'rgba(240,62,62,0.1)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-muted)'
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Summary Strip Footer Bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderTop: '1px solid var(--border-color, #232334)',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                }}
              >
                <div style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid var(--border-color, #232334)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Trades: </span>
                  <span style={{ color: 'var(--text-main)', fontWeight: '700' }}>{extractedTrades.length}</span>
                </div>
                <div style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid var(--border-color, #232334)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fees: </span>
                  <span style={{ color: 'var(--text-main)', fontWeight: '700' }}>
                    {totalFees < 0 ? '-' : ''}{currencySymbol}{Math.abs(totalFees).toFixed(2)}
                  </span>
                </div>
                <div style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid var(--border-color, #232334)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Win Rate: </span>
                  <span style={{ color: 'var(--text-main)', fontWeight: '700' }}>
                    {winCount}/{extractedTrades.length}
                  </span>
                </div>
                <div style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total P&L: </span>
                  <span style={{ color: totalPnl >= 0 ? themeColor : 'var(--color-loss)', fontWeight: '700' }}>
                    {totalPnl >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(totalPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-color, #232334)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading || saving}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              cursor: loading || saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>

          {!loading && extractedTrades.length > 0 && (
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              style={{
                padding: '10px 24px',
                backgroundColor: themeColor,
                border: 'none',
                borderRadius: '8px',
                color: '#000',
                fontWeight: '700',
                fontSize: '0.875rem',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                boxShadow: `0 2px 10px ${themeColor}33`,
                fontFamily: 'inherit',
              }}
            >
              {saving ? 'Saving…' : `Save ${extractedTrades.length} Trades (${currencySymbol})`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
