/**
 * Parses raw date strings extracted from broker screenshots/tables into ISO 8601 strings
 * compatible with Supabase timestamptz.
 *
 * Source of truth: Day is ALWAYS the 1st number, Month is ALWAYS the 2nd number, Year is ALWAYS the 3rd number.
 *
 * Supported formats:
 *  - DD.MM.YY HH:mm or DD.MM.YYYY HH:mm (e.g. "06.08.26 10:24" => 6th Aug 2026 10:24)
 *  - DD/MM/YY HH:mm or DD/MM/YYYY HH:mm (e.g. "06/08/2026 10:24" => 6th Aug 2026 10:24)
 *  - DD-MM-YY HH:mm or DD-MM-YYYY HH:mm (e.g. "06-08-2026 10:24" => 6th Aug 2026 10:24)
 *  - YYYY-MM-DD HH:mm or YYYY-MM-DDTHH:mm:ss
 */
export function parseBrokerDate(raw) {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // 1. Check YYYY-MM-DD HH:mm(:ss) format
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (isoMatch) {
    const [, yyyy, mm, dd, hh = '00', min = '00', ss = '00'] = isoMatch
    const isoStr = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${hh.padStart(2, '0')}:${min.padStart(2, '0')}:${ss.padStart(2, '0')}`
    const d = new Date(isoStr)
    if (!isNaN(d.getTime())) return d.toISOString()
  }

  // 2. Check DD.MM.YY(YY), DD/MM/YY(YY), or DD-MM-YY(YY) HH:mm(:ss) (Day - Month - Year)
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (dmyMatch) {
    const [, dd, mm, yy, hh = '00', min = '00', ss = '00'] = dmyMatch
    const fullYear = yy.length === 2 ? 2000 + parseInt(yy, 10) : parseInt(yy, 10)
    const isoStr = `${fullYear}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${hh.padStart(2, '0')}:${min.padStart(2, '0')}:${ss.padStart(2, '0')}`
    const d = new Date(isoStr)
    if (!isNaN(d.getTime())) return d.toISOString()
  }

  // 3. Fallback to standard JS Date parsing
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) return d.toISOString()

  return null
}
