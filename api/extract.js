// Vercel serverless function (Edge runtime compatible).
// Receives base64 image, calls Gemini Flash AI with forced JSON schema.

export const config = { runtime: 'edge' };

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
};

const CANDIDATE_MODELS = [
  'gemini-3.6-flash',
];

const PROMPT_TEXT =
  'Extract every row from this trade history table into the given JSON schema. ' +
  'Read every field exactly as printed. Do not invent, round, or guess any value. ' +
  'Dates in broker tables are printed as Day.Month.Year Hour:Minute (DD.MM.YY HH:mm, e.g. 06.08.26 10:24 is Day=06, Month=08, Year=26) — copy them exactly as printed into open_date_raw / close_date_raw without reformatting. ' +
  'If a value is genuinely not visible for a row, omit that field rather than guessing.';

async function callGeminiWithFallbackAndRetry(apiKey, imageBase64, mimeType) {
  let errors = [];

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
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
                    {
                      text: PROMPT_TEXT,
                    },
                    {
                      inline_data: {
                        mime_type: mimeType || 'image/jpeg',
                        data: imageBase64,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: TRADE_SCHEMA,
              },
            }),
          }
        );

        const errData = await res.json().catch(() => ({}));

        if (res.ok) {
          const text = errData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const cleaned = text.replace(/```json|```/g, '').trim();
            return JSON.parse(cleaned);
          }
        }

        const msg = errData?.error?.message || `HTTP ${res.status}`;

        // If 400, 401, or 403, try Authorization Bearer header if key starts with AQ
        if ((res.status === 400 || res.status === 401 || res.status === 403) && apiKey.startsWith('AQ.')) {
          const bearerRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'x-goog-api-key': apiKey,
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: PROMPT_TEXT,
                      },
                      {
                        inline_data: {
                          mime_type: mimeType || 'image/jpeg',
                          data: imageBase64,
                        },
                      },
                    ],
                  },
                ],
                generationConfig: {
                  responseMimeType: 'application/json',
                  responseSchema: TRADE_SCHEMA,
                },
              }),
            }
          );

          if (bearerRes.ok) {
            const bearerData = await bearerRes.json();
            const text = bearerData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const cleaned = text.replace(/```json|```/g, '').trim();
              return JSON.parse(cleaned);
            }
          }
        }

        // If still API key error, throw exact message
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          throw new Error(`Gemini API Key Error (${res.status}): ${msg}`);
        }

        if (res.status === 503 || res.status === 429) {
          console.warn(`[Gemini API ${res.status}] ${model} attempt ${attempt} busy. Retrying...`);
          await new Promise((r) => setTimeout(r, attempt * 1200));
          continue;
        }

        errors.push(`[${model}]: ${msg}`);
        break;
      } catch (err) {
        if (err.message.includes('Gemini API Key Error')) throw err;
        errors.push(`[${model}]: ${err.message}`);
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }

  throw new Error(errors.join(' | ') || 'All Gemini models failed.');
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Server not configured (missing GEMINI_API_KEY in environment variables)' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const parsedData = await callGeminiWithFallbackAndRetry(apiKey, imageBase64, mimeType);

    return new Response(JSON.stringify(parsedData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Extraction failed', detail: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
