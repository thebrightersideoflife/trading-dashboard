import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../api/supabaseClient'

/**
 * useJournal
 *
 * Fetches all journal entries and trade notes for the current user.
 * Exposes upsert actions that call the Postgres RPCs.
 *
 * Parameters:
 *   sessionReady — bool, waits for auth before querying
 *   monthDate    — optional Date object; if provided, also fetches
 *                  entries for that month's range (for the calendar panel).
 *                  If null, fetches all entries.
 */
export function useJournal(sessionReady = true) {
  const [entries,    setEntries]    = useState([])  // journal_entries rows
  const [tradeNotes, setTradeNotes] = useState([])  // trade_notes rows
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: entryData,     error: entryErr     },
        { data: tradeNoteData, error: tradeNoteErr },
      ] = await Promise.all([
        supabase
          .from('journal_entries')
          .select('*')
          .order('entry_date', { ascending: false }),
        supabase
          .from('trade_notes')
          .select('*')
          .order('created_at', { ascending: false }),
      ])
      const firstError = entryErr || tradeNoteErr
      if (firstError) throw firstError
      setEntries(entryData    ?? [])
      setTradeNotes(tradeNoteData ?? [])
    } catch (err) {
      console.error('[useJournal]', err)
      setError(err.message ?? 'Failed to load journal')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Upsert a daily journal entry ─────────────────────────────
  // Returns { success, data, error }
  const upsertEntry = useCallback(async ({ entryDate, note, mood, confidence }) => {
    try {
      const { data, error } = await supabase.rpc('upsert_journal_entry', {
        p_entry_date:  entryDate,
        p_note:        note        ?? null,
        p_mood:        mood        ?? null,
        p_confidence:  confidence  ?? null,
      })
      if (error) throw error
      const updated = typeof data === 'string' ? JSON.parse(data) : data
      // Update local state immediately
      setEntries(prev => {
        const idx = prev.findIndex(e => e.entry_date === entryDate)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...prev[idx], ...updated }
          return next
        }
        return [updated, ...prev]
      })
      return { success: true, data: updated }
    } catch (err) {
      console.error('[upsertEntry]', err)
      return { success: false, error: err.message }
    }
  }, [])

  // ── Upsert a trade-level note ─────────────────────────────────
  const upsertTradeNote = useCallback(async ({ tradeId, note, mistakeCategory, outcomeTag }) => {
    try {
      const { data, error } = await supabase.rpc('upsert_trade_note', {
        p_trade_id:         tradeId,
        p_note:             note             ?? null,
        p_mistake_category: mistakeCategory  ?? null,
        p_outcome_tag:      outcomeTag       ?? null,
      })
      if (error) throw error
      const updated = typeof data === 'string' ? JSON.parse(data) : data
      setTradeNotes(prev => {
        const idx = prev.findIndex(n => n.trade_id === tradeId)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...prev[idx], ...updated }
          return next
        }
        return [updated, ...prev]
      })
      return { success: true, data: updated }
    } catch (err) {
      console.error('[upsertTradeNote]', err)
      return { success: false, error: err.message }
    }
  }, [])

  // ── Delete a trade note ───────────────────────────────────────
  const deleteTradeNote = useCallback(async (tradeId) => {
    try {
      const { error } = await supabase.rpc('delete_trade_note', { p_trade_id: tradeId })
      if (error) throw error
      setTradeNotes(prev => prev.filter(n => n.trade_id !== tradeId))
      return { success: true }
    } catch (err) {
      console.error('[deleteTradeNote]', err)
      return { success: false, error: err.message }
    }
  }, [])

  // ── Helpers ───────────────────────────────────────────────────
  // Get entry for a specific date string 'YYYY-MM-DD'
  const getEntryForDate = useCallback((dateStr) =>
    entries.find(e => e.entry_date === dateStr) ?? null,
    [entries]
  )

  // Get trade note for a specific trade_id
  const getNoteForTrade = useCallback((tradeId) =>
    tradeNotes.find(n => n.trade_id === tradeId) ?? null,
    [tradeNotes]
  )

  // Whether today's entry is still editable (date is today in local time)
  const isTodayEditable = useCallback((entryDate) => {
    const today = new Date()
    const local = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    return entryDate === local
  }, [])

  useEffect(() => {
    if (sessionReady) fetchAll()
  }, [sessionReady, fetchAll])

  return {
    entries,
    tradeNotes,
    loading,
    error,
    refetch:         fetchAll,
    upsertEntry,
    upsertTradeNote,
    deleteTradeNote,
    getEntryForDate,
    getNoteForTrade,
    isTodayEditable,
  }
}