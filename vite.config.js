import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const TRADE_SCHEMA = {
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

async function callGeminiLocal(apiKey, imageBase64, mimeType) {
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
                responseSchema: TRADE_SCHEMA,
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
          console.warn(`[Gemini API 429/503 for ${model}] Rate limit reached. Trying fallback candidate model...`)
          break
        }

        if (res.status === 404) {
          console.warn(`[Gemini API 404 for ${model}] Model not found. Trying next model...`)
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

  throw new Error(lastError || 'Gemini API is temporarily busy. Please try again in 10 seconds.')
}

function extractApiPlugin() {
  return {
    name: 'vite-plugin-extract-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/extract' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', async () => {
            try {
              const { imageBase64, mimeType } = JSON.parse(body || '{}')
              const env = loadEnv('development', process.cwd(), '')
              const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY

              if (!apiKey) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Missing GEMINI_API_KEY in .env file' }))
                return
              }

              const result = await callGeminiLocal(apiKey, imageBase64, mimeType)
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result))
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Extraction failed', detail: err.message }))
            }
          })
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), extractApiPlugin()],
})
