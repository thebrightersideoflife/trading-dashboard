import { useEffect, useState } from 'react'
import { supabase } from '../api/supabaseClient'

export function useTradingData() {
  const [metrics, setMetrics] = useState(null)
  const [dailyPnL, setDailyPnL] = useState([])
  const [equityCurve, setEquityCurve] = useState([])
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)

    const [
      { data: metricsData },
      { data: pnlData },
      { data: equityData },
      { data: tradesData }
    ] = await Promise.all([
      supabase.from('dashboard_metrics').select('*').single(),
      supabase.from('daily_pnl').select('*'),
      supabase.from('equity_curve').select('*'),
      supabase.from('trades').select('*').order('close_time', { ascending: false })
    ])

    setMetrics(metricsData)
    setDailyPnL(pnlData || [])
    setEquityCurve(equityData || [])
    setTrades(tradesData || [])

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  return {
    metrics,
    dailyPnL,
    equityCurve,
    trades,
    loading,
    refetch: fetchData
  }
}