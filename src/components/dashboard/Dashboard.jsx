import '../../assets/styles/colors.css';
import '../../assets/styles/dashboard.css';
import { useTradingData } from '../../hooks/useTradingData';
import { supabase } from '../../api/supabaseClient';
import StatCard from './StatCard';
import { formatCurrency, formatPercent } from '../../utils/formatters';

export default function Dashboard() {
  const { metrics, loading } = useTradingData();

  if (loading) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ animation: 'pulse 1.5s infinite', color: 'var(--text-muted)' }}>
          Loading dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', letterSpacing: '-0.025em' }}>
            Account Overview
          </h1>
          <button
            className="btn-primary"
            onClick={async () => {
              await supabase.rpc('add_trade', {
                p_symbol: 'NAS100',
                p_side: 'Buy',
                p_open_time: new Date(),
                p_close_time: new Date(),
                p_entry_price: 15000,
                p_exit_price: 15150, // Slight profit
                p_quantity: 1,
                p_fees: 0,
                p_swap: 0,
                p_realized_pnl: 150 
              });
              window.location.reload();
            }}
          >
            + Add Test Trade
          </button>
        </header>

        {/* Primary Metrics Grid */}
        <div className="stats-grid">
          <StatCard title="Net Profit" value={formatCurrency(metrics?.net_profit)} isNegative={metrics?.net_profit < 0} />
          <StatCard title="Gross Profit" value={formatCurrency(metrics?.gross_profit)} />
          <StatCard title="Gross Loss" value={formatCurrency(metrics?.gross_loss)} />
          <StatCard title="Win Rate" value={formatPercent(metrics?.win_rate)} />
          <StatCard title="Total Trades" value={metrics?.total_trades || 0} />
          <StatCard title="Best Trade" value={formatCurrency(metrics?.best_trade)} />
          <StatCard title="Worst Trade" value={formatCurrency(metrics?.worst_trade)} isNegative={metrics?.worst_trade < 0} />
          <StatCard title="Avg Trade" value={formatCurrency(metrics?.avg_trade)} isNegative={metrics?.avg_trade < 0} />
        </div>

        {/* Chart Section Placeholder */}
        <div style={{ 
          marginTop: '2rem', 
          backgroundColor: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '1rem',
          height: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem', fontWeight: '500' }}>
            Equity Curve Chart
          </span>
          {/* We will place Recharts here next */}
        </div>

      </div>
    </div>
  );
}