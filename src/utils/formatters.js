export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

export function formatPercent(value) {
  if (value == null) return '0.00%'
  return `${Number(value).toFixed(2)}%`
}

export function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleString('en-GB', {
    day:    '2-digit',
    month:  '2-digit',
    year:   '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

/**
 * formatDuration
 * Converts a duration in seconds to "0h:29m:52s" style string.
 */
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0h:00m:00s'
  const s   = Math.round(Math.abs(seconds))
  const hrs = Math.floor(s / 3600)
  const min = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${hrs}h:${String(min).padStart(2, '0')}m:${String(sec).padStart(2, '0')}s`
}