/**
 * journalConstants.js
 * Shared enums for the journal system.
 * Stored as text in the DB — these lists live only in the frontend.
 * Add to them freely; old values in the DB remain valid.
 */

export const MISTAKE_CATEGORIES = [
  'Good execution',
  'FOMO',
  'Revenge trade',
  'Overtrading',
  'Poor entry timing',
  'Poor exit timing',
  'Ignored stop loss',
  'Sized too large',
  'Sized too small',
  'News / event risk',
  'Distracted',
  'Other',
]

export const OUTCOME_TAGS = [
  'Followed plan',
  'Broke rules',
  'Lucky win',
  'Unlucky loss',
  'Good risk/reward',
  'Bad risk/reward',
  'Early exit',
  'Late exit',
  'Held too long',
  'Cut too soon',
]

export const MOOD_LABELS = {
  1: { label: 'Poor',      color: '#f03e3e' },
  2: { label: 'Below avg', color: '#f59f00' },
  3: { label: 'Neutral',   color: '#52526a' },
  4: { label: 'Good',      color: '#74c0fc' },
  5: { label: 'Great',     color: '#c8f135' },
}

export const CONFIDENCE_LABELS = {
  1: { label: 'Very low',  color: '#f03e3e' },
  2: { label: 'Low',       color: '#f59f00' },
  3: { label: 'Moderate',  color: '#52526a' },
  4: { label: 'High',      color: '#74c0fc' },
  5: { label: 'Very high', color: '#c8f135' },
}

// Returns today's date as 'YYYY-MM-DD' in local time
export function todayLocalDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Formats 'YYYY-MM-DD' → 'Mon 7 Apr 2026'
export function formatEntryDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00') // noon avoids DST shift
  return d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })
}