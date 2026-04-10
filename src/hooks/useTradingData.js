import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../api/supabaseClient'

export function useTradingData(sessionReady = true, showDemoProp = null, equityCutoff = null) {
  const [metrics,      setMetrics]      = useState(null)
  const [equityCurve,  setEquityCurve]  = useState([])
  const [dailyPnl,     setDailyPnl]     = useState([])
  const [trades,       setTrades]       = useState([])
  const [profile,      setProfile]      = useState(null)
  const [weekTargets,  setWeekTargets]  = useState([])
  const [hasMockData,  setHasMockData]  = useState(false)
  const [showDemoData, setShowDemoData] = useState(true)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // ── 1. Fetch profile first to know which view pair to use ──
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('initial_balance, profit_target, weekly_default_target, currency, timezone, show_demo_data')
        .maybeSingle()
      if (profileErr) throw profileErr

      // showDemoProp comes from App state (already persisted to Postgres).
      // We trust it directly when provided so the view switches instantly
      // without waiting for the profile re-read.
      const showDemo = showDemoProp != null
        ? showDemoProp
        : (profileData?.show_demo_data ?? true)

      // ── 2. Choose view names based on demo toggle ──────────────
      // _real views filter is_mock = false at the DB level.
      // Default views include all trades (real + mock).
      const metricsView  = showDemo ? 'dashboard_metrics'  : 'dashboard_metrics_real'
      const equityView   = showDemo ? 'equity_curve'        : 'equity_curve_real'
      const dailyView    = showDemo ? 'daily_pnl'           : 'daily_pnl_real'

      // ── 3. Fetch everything in parallel ───────────────────────
      const [
        { data: metricsData,     error: metricsErr     },
        { data: equityData,      error: equityErr      },
        { data: dailyData,       error: dailyErr       },
        { data: tradesData,      error: tradesErr      },
        { count: mockCount,      error: mockErr        },
        { data: weekTargetsData, error: weekTargetsErr },
      ] = await Promise.all([
        supabase.from(metricsView).select('*').maybeSingle(),
        (() => {
          let q = supabase.from(equityView).select('close_time, equity').order('close_time', { ascending: true })
          if (equityCutoff) q = q.gte('close_time', equityCutoff)
          return q
        })(),
        supabase.from(dailyView).select('day, total_pnl, trades'),
        supabase.from('trades').select('*').order('close_time', { ascending: false }),
        supabase.from('trades').select('id', { count: 'exact', head: true }).eq('is_mock', true),
        supabase.from('week_targets').select('week_start, target').order('week_start', { ascending: false }),
      ])

      const firstError = metricsErr || equityErr || dailyErr
                       || tradesErr || mockErr   || weekTargetsErr
      if (firstError) throw firstError

      setShowDemoData(showDemo)
      setHasMockData((mockCount ?? 0) > 0)

      // ── 4. Derive metrics ──────────────────────────────────────
      const initialBalance      = profileData?.initial_balance       ?? 5000
      const profitTarget        = profileData?.profit_target         ?? 30
      const weeklyDefaultTarget = profileData?.weekly_default_target ?? 500
      const netProfit           = Number(metricsData?.net_profit ?? 0)
      const currentBalance      = initialBalance + netProfit

      const hwm = equityData?.length
        ? initialBalance + Math.max(...equityData.map(r => Number(r.equity)))
        : initialBalance

      const grossProfit  = Number(metricsData?.gross_profit ?? 0)
      const grossLoss    = Number(metricsData?.gross_loss   ?? 0)
      const profitFactor = grossLoss > 0
        ? grossProfit / grossLoss
        : grossProfit > 0 ? Infinity : 0
      const expectancy   = Number(metricsData?.avg_trade ?? 0)

      const allTrades    = tradesData ?? []

      // avg trade size from the appropriate trade set
      const relevantTrades = showDemo
        ? allTrades
        : allTrades.filter(t => !t.is_mock)
      const avgTradeSize = relevantTrades.length
        ? relevantTrades.reduce((s, t) => s + Number(t.quantity ?? 0), 0) / relevantTrades.length
        : 0

      // avg duration from real trades only (mock durations are synthetic)
      const realTrades = allTrades.filter(t => !t.is_mock)
      let avgDurationSec = 0
      if (realTrades.length) {
        const durations = realTrades
          .filter(t => t.open_time && t.close_time)
          .map(t => (new Date(t.close_time) - new Date(t.open_time)) / 1000)
        if (durations.length)
          avgDurationSec = durations.reduce((a, b) => a + b, 0) / durations.length
      }

      setMetrics({
        ...metricsData,
        total_trades:          Number(metricsData?.total_trades ?? 0),
        gross_profit:          grossProfit,
        gross_loss:            grossLoss,
        net_profit:            netProfit,
        avg_trade:             expectancy,
        best_trade:            Number(metricsData?.best_trade  ?? 0),
        worst_trade:           Number(metricsData?.worst_trade ?? 0),
        win_rate:              Number(metricsData?.win_rate    ?? 0),
        profit_factor:         profitFactor,
        expectancy,
        avg_trade_size:        avgTradeSize,
        current_balance:       currentBalance,
        initial_balance:       initialBalance,
        hwm,
        pnl_from_hwm:          currentBalance - hwm,
        profit_target_pct:     profitTarget,
        drawdown_from_target:  initialBalance > 0
          ? (netProfit / initialBalance) * 100
          : 0,
        avg_duration_sec:      avgDurationSec,
        currency:              profileData?.currency            ?? 'USD',
        weekly_default_target: weeklyDefaultTarget,
      })

      // ── 5. Equity curve — offset by initial balance ────────────
      const curve = (equityData ?? []).map(row => ({
        date:    row.close_time,
        balance: initialBalance + Number(row.equity),
      }))
      if (!curve.length || curve[0].balance !== initialBalance)
        curve.unshift({ date: null, balance: initialBalance })
      setEquityCurve(curve)

      setDailyPnl(dailyData         ?? [])
      setTrades(allTrades)
      setProfile(profileData        ?? {})
      setWeekTargets(weekTargetsData ?? [])

    } catch (err) {
      console.error('[useTradingData]', err)
      setError(err.message ?? 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [showDemoProp, equityCutoff])

  // ── Upsert a week target — local state update + RPC ───────────────
  const upsertWeekTarget = useCallback(async (weekStart, target) => {
    const { error } = await supabase.rpc('upsert_week_target', {
      p_week_start: weekStart,
      p_target:     Number(target),
    })
    if (error) {
      console.error('[upsertWeekTarget]', error)
      return { success: false, error: error.message }
    }
    setWeekTargets(prev => {
      const idx = prev.findIndex(wt => wt.week_start === weekStart)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { week_start: weekStart, target: Number(target) }
        return next
      }
      return [{ week_start: weekStart, target: Number(target) }, ...prev]
    })
    return { success: true }
  }, [])

  useEffect(() => {
    if (sessionReady) fetchAll()
  }, [sessionReady, showDemoProp, equityCutoff, fetchAll])

  return {
    metrics,
    equityCurve,
    dailyPnl,
    trades,
    profile,
    weekTargets,
    hasMockData,
    showDemoData,
    loading,
    error,
    refetch:          fetchAll,
    upsertWeekTarget,
  }
}