import { useState, useEffect } from 'react'
import { supabase } from '../api/supabaseClient'

/**
 * useAuth
 *
 * Returns the current Supabase session and a `sessionReady` flag.
 * sessionReady = false means Supabase hasn't finished restoring the
 * session from localStorage yet — components should wait before
 * making authenticated queries.
 */
export function useAuth() {
  const [session,      setSession]      = useState(null)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // getSession() resolves the persisted token synchronously on first call
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setSessionReady(true)
    })

    // Keep session in sync across tabs / token refreshes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setSessionReady(true)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { session, sessionReady, user: session?.user ?? null }
}