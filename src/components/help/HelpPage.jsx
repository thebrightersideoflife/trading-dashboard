import { useState } from 'react'
import '../../assets/styles/colors.css'
import '../../assets/styles/dashboard.css'

const SECTIONS = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'logging-trades',  label: 'Logging Trades'  },
  { id: 'dashboard',       label: 'Dashboard'        },
  { id: 'calendar',        label: 'Calendar'         },
  { id: 'journal',         label: 'Journal'          },
  { id: 'analytics',       label: 'Analytics'        },
  { id: 'demo-data',       label: 'Demo Data'        },
  { id: 'learning',        label: 'Learning Path'    },
]

export default function HelpPage() {
  const [active, setActive] = useState('getting-started')

  return (
    <div className="dashboard-container">
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* Hero Header */}
        <header style={{
          marginBottom: '2rem',
          padding: '24px 28px',
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-soft)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--gradient-subtle)',
            pointerEvents: 'none',
          }} />
          <h1 style={{
            fontSize: '1.7rem',
            fontWeight: '700',
            letterSpacing: '-0.03em',
            color: 'var(--text-main)',
            margin: 0,
            position: 'relative',
          }}>
            Help & Guide
          </h1>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: '0.95rem',
            margin: '6px 0 0',
            position: 'relative',
          }}>
            Master CogentLog — from first trade to consistent profitability
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem', alignItems: 'start' }}
             className="help-layout">

          {/* Sidebar nav */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-soft)',
            position: 'sticky',
            top: '86px',
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '0.72rem', fontWeight: '600',
              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Contents
            </div>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  background: active === s.id ? 'var(--bg-glass-strong)' : 'transparent',
                  border: 'none',
                  borderLeft: active === s.id ? '3px solid var(--accent-lime)' : '3px solid transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  fontSize: '0.88rem',
                  fontWeight: active === s.id ? '600' : '400',
                  color: active === s.id ? 'var(--text-main)' : 'var(--text-muted)',
                  borderBottom: '1px solid var(--border-subtle)',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  if (active !== s.id) {
                    e.currentTarget.style.background = 'var(--bg-glass)'
                  }
                }}
                onMouseLeave={e => {
                  if (active !== s.id) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Content card */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-soft)',
            padding: '34px 38px',
            minHeight: '500px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Radial glow layer */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 20% 0%, rgba(200,241,53,0.06), transparent 40%)',
              pointerEvents: 'none',
            }} />

            {active === 'getting-started' && (
              <Section title="Getting Started">
                <P>Welcome to <Strong>CogentLog</Strong> — a trading journal and performance dashboard built to help you understand your trading, not just record it.</P>
                <Steps steps={[
                  { n: 1, title: 'Set up your profile', body: 'Go to Profile Settings and enter your initial account balance, profit target, preferred currency, and timezone. These values drive all calculations across the dashboard.' },
                  { n: 2, title: 'Log your first trade', body: 'Click "+ Add Trade" on the Dashboard or Trades page. Fill in the symbol, side (Buy/Sell), open and close times, entry and exit prices, quantity, fees, and the realized P&L from your broker.' },
                  { n: 3, title: 'Review your dashboard', body: 'After adding a few trades, your Dashboard will populate with metrics, an equity curve, and a trade calendar. The more trades you add, the more useful Analytics becomes.' },
                  { n: 4, title: 'Write journal entries', body: 'Visit the Journal page each trading day to log your mood, confidence, and a daily note. Attach per-trade notes with mistake categories to build self-awareness over time.' },
                ]} />
                <Note>Your data is private — stored securely in your own Supabase project and visible only to you.</Note>
              </Section>
            )}

            {active === 'logging-trades' && (
              <Section title="Logging Trades">
                <P>CogentLog records closed trades only. Open positions are not tracked — add a trade once it is fully closed on your broker platform.</P>

                <H2>The most important field: Realized P&L</H2>
                <P>It is strongly recommended that you <Strong>do not</Strong> calculate P&L yourself from entry/exit prices. Instead, copy the final realized P&L directly from your broker's trade history.</P>

                <Callout color="amber">
                  <Strong>Why the math trap exists:</Strong> Exact P&L depends on asset class. For Forex, pip value changes based on the quote currency pair. For indices like NAS100 or SP500, contract sizes vary by broker ($1/point vs $10/point). For crypto, the quote currency fluctuates. Your broker calculates this flawlessly in real-time — trust their number.
                </Callout>

                <H2>Fields explained</H2>
                <FieldTable fields={[
                  { name: 'Symbol', desc: 'The instrument traded — e.g. EURUSD, NAS100, BTCUSD.' },
                  { name: 'Side', desc: 'Buy (long) or Sell (short).' },
                  { name: 'Open Time', desc: 'When the trade was opened. Used to calculate duration.' },
                  { name: 'Close Time', desc: 'When the trade was closed. Used to bucket trades into calendar days.' },
                  { name: 'Entry Price', desc: 'Your entry price. Stored for reference and review — not used in P&L math.' },
                  { name: 'Exit Price', desc: 'Your exit price. Same as above.' },
                  { name: 'Quantity', desc: 'Lot size or number of units traded.' },
                  { name: 'Fees', desc: 'Commission charged by your broker. Optional — enter 0 if included in P&L.' },
                  { name: 'Swap', desc: 'Overnight swap/rollover charges. Optional — enter 0 if included in P&L.' },
                  { name: 'Realized P&L', desc: 'The final profit or loss in your account currency. Copy this directly from your broker.' },
                ]} />

                <Note>Fees and swap are optional. If your broker already deducts them from the reported P&L, leave both at 0 to avoid double-counting.</Note>
              </Section>
            )}

            {active === 'dashboard' && (
              <Section title="Dashboard">
                <P>The Dashboard gives you a complete snapshot of your account. All metrics update whenever you add, edit, or delete a trade.</P>

                <H2>Metric cards</H2>
                <FieldTable fields={[
                  { name: 'Net Profit', desc: 'Total realized P&L across all closed trades.' },
                  { name: 'Gross Profit', desc: 'Sum of all winning trades only.' },
                  { name: 'Gross Loss', desc: 'Sum of all losing trades (shown as a positive number).' },
                  { name: 'P&L from All-Time HWM', desc: 'How far your current balance sits below the highest balance you have ever reached. A negative value means you are in drawdown.' },
                  { name: 'Profit Target', desc: 'A semi-circle gauge showing your % gain toward the target you set in Profile. Red → amber → lime as you approach it.' },
                  { name: 'Profit Factor', desc: 'Gross Profit ÷ Gross Loss. Above 1.0 means you make more on winners than you lose on losers. A value above 1.5 is considered strong.' },
                  { name: 'Expectancy', desc: 'Average P&L per trade. A positive expectancy means your strategy has an edge.' },
                  { name: 'Win / Loss Rate', desc: 'Percentage of closed trades that finished in profit.' },
                  { name: 'Avg Trade Duration', desc: 'Mean time between open and close across real trades.' },
                ]} />

                <H2>Equity curve</H2>
                <P>The area chart shows your account balance growing (or falling) with each closed trade. Use the All / 6M / 3M / 1M pills to zoom into a time window — the data is filtered at the database level so it stays fast regardless of how many trades you have.</P>

                <H2>Trade calendar (mini)</H2>
                <P>The calendar below the chart colours each day by its P&L — lime for profit, red for loss, intensity proportional to size. It gives a quick visual of consistency.</P>
              </Section>
            )}

            {active === 'calendar' && (
              <Section title="Calendar">
                <P>The Calendar page is a full-page version of the heatmap with weekly target tracking added.</P>

                <H2>Weekly targets</H2>
                <P>Each week shows a progress bar comparing your actual P&L to a target. The default target comes from your Profile setting (<Strong>Weekly Default Target</Strong>). Click the target button on any week to override it for that specific week — useful for weeks you plan to trade conservatively or aggressively.</P>

                <H2>Journal panel</H2>
                <P>Click any day cell to open a slide-in panel showing the journal entry and trade notes for that day. From there you can write or read entries without leaving the calendar.</P>

                <H2>Demo data toggle</H2>
                <P>The calendar respects the demo data toggle. When demo is off, only your real trades appear in the heatmap and weekly totals.</P>
              </Section>
            )}

            {active === 'journal' && (
              <Section title="Journal">
                <P>The Journal is designed for daily reflection — the habit that separates improving traders from those who repeat the same mistakes.</P>

                <H2>Daily entries</H2>
                <P>Each day gets one entry. Rate your <Strong>mood</Strong> (how you felt generally) and <Strong>confidence</Strong> (how certain you felt about your trades) on a 1–5 scale. Add a free-form daily note covering your mindset, what you did well, and what you would do differently.</P>

                <Callout color="lime">
                  Entries are <Strong>editable today only</Strong>. Once midnight passes, the entry locks. This is intentional — it prevents revisionist journaling and keeps your records honest.
                </Callout>

                <H2>Trade notes</H2>
                <P>Each trade that closed on a given day appears as a collapsible card inside the journal entry. You can attach:</P>
                <ul style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.8, paddingLeft: '20px' }}>
                  <li><Strong>Mistake category</Strong> — e.g. FOMO, Revenge trade, Poor exit timing, Good execution</li>
                  <li><Strong>Outcome tag</Strong> — e.g. Followed plan, Broke rules, Lucky win, Cut too soon</li>
                  <li><Strong>Trade note</Strong> — free text about that specific trade</li>
                </ul>
                <P>Trade notes are always editable, unlike daily entries.</P>

                <H2>Dot indicators</H2>
                <P>In the date list, a <Strong style={{ color: 'var(--accent-lime)' }}>lime dot</Strong> means a daily entry has been written. A <Strong style={{ color: '#74c0fc' }}>blue dot</Strong> means at least one trade note has been written for that day.</P>
              </Section>
            )}

            {active === 'analytics' && (
              <Section title="Analytics">
                <P>Analytics processes your closed trades to surface patterns that the Dashboard's summary numbers can't show. It is organised into four sections.</P>

                <H2>Edge</H2>
                <P>Answers: <em style={{ color: 'var(--text-muted)' }}>where is my money actually coming from?</em></P>
                <P>P&L broken down by symbol reveals which instruments you trade profitably and which you should stop trading. P&L by side (Buy vs Sell) reveals directional bias — many beginners are systematically better on one side without realising it.</P>

                <H2>Timing</H2>
                <P>Answers: <em style={{ color: 'var(--text-muted)' }}>when do I perform best and worst?</em></P>
                <P>Day-of-week and hour-of-day breakdowns are among the most actionable analytics available. If you consistently lose on Fridays after 3pm, you can simply stop trading then. No strategy change required.</P>

                <H2>Risk</H2>
                <P>Answers: <em style={{ color: 'var(--text-muted)' }}>am I managing my positions well?</em></P>
                <P>The average win vs average loss ratio tells you whether your winners are larger than your losers. A ratio below 1.0 means you need a win rate above 50% just to break even. The P&L distribution histogram shows the shape of your trades — a healthy pattern has frequent small losses and occasional larger wins.</P>

                <H2>Progress</H2>
                <P>Answers: <em style={{ color: 'var(--text-muted)' }}>am I getting better over time?</em></P>
                <P>Monthly P&L bars show trajectory clearly. The drawdown chart shows how far your equity fell from its peak at every point in your trading history — useful for understanding your worst periods and recovery time.</P>
              </Section>
            )}

            {active === 'demo-data' && (
              <Section title="Demo Data">
                <P>When you first sign in, CogentLog loads a set of sample trades so the dashboard is populated and you can explore the interface immediately.</P>

                <H2>Toggling demo data</H2>
                <P>The demo toggle is in your <Strong>Profile Settings</Strong> under the Demo Data section, and also in the <Strong>Header menu</Strong> on any page. When you switch it off, all views — Dashboard metrics, equity curve, calendar, trades list, analytics, and journal sidebar — switch to showing your real trades only.</P>

                <H2>Demo data and new features</H2>
                <P>CogentLog uses demo data to preview new features before you have enough real trades to see them. When a new feature ships, turning demo back on will let you see it with populated data. This is intentional — demo data is not just for onboarding.</P>

                <H2>When to turn demo off</H2>
                <P>Once you have added your first real trades and want to see your actual performance, turn demo off. Your real trades will then be the only source of truth for all calculations. The demo trades remain in the database and can be re-enabled at any time — they are never deleted automatically.</P>

                <Note>If you want to remove demo trades permanently, go to the Trades page, filter by symbol, and delete them individually. Future versions may add a one-click "Remove all demo trades" action.</Note>
              </Section>
            )}

            {active === 'learning' && (
              <Section title="Learning Path">
                <P>CogentLog records what you do — but improving as a trader requires understanding <em>why</em>. Here is a curated set of free, high-quality resources organised by topic.</P>

                <H2>Risk management — start here</H2>
                <P>Risk management is the single most important skill for a beginner. Most new traders blow accounts not because their strategy is wrong, but because their position sizing is reckless.</P>
                <ResourceList resources={[
                  { title: 'What is Paper Trading?', url: 'https://www.cmcmarkets.com/en-gb/trading-strategy/what-is-paper-trading', desc: 'An introduction to paper trading and its benefits for new traders.' },
                  { title: 'Investopedia: Risk Management in Finance', url: 'https://www.investopedia.com/terms/r/riskmanagement.asp', desc: 'Clear explanation of risk-reward ratios, position sizing, and the 1% rule.' },
                  { title: 'BabyPips: Money Management', url: 'https://www.babypips.com/forexpedia/money-management', desc: 'Beginner-friendly course covering lot sizes, leverage, and stop placement for Forex traders.' },
                  { title: 'Investopedia: What is a Stop-Loss Order?', url: 'https://www.investopedia.com/terms/s/stop-lossorder.asp', desc: 'Why every trade must have a stop, and how to place one correctly.' },
                ]} />

                <H2>Trading psychology</H2>
                <P>Your biggest enemy as a trader is yourself. FOMO, revenge trading, and overconfidence destroy more accounts than bad strategies.</P>
                <ResourceList resources={[
                  { title: 'BabyPips: Trading Psychology', url: 'https://www.babypips.com/trading/psychology-4-common-trading-psychological-roadblocks-2025-09-10', desc: 'A practical guide to managing emotions, building discipline, and avoiding common psychological traps.' },
                  { title: 'Investopedia: Trading Psychology', url: 'https://www.investopedia.com/terms/t/trading-psychology.asp', desc: 'Overview of cognitive biases that affect traders — anchoring, loss aversion, and confirmation bias.' },
                ]} />

                <H2>Reading charts (technical analysis)</H2>
                <P>Understanding price action is essential for knowing when and where to enter and exit trades.</P>
                <ResourceList resources={[
                  { title: 'Investopedia: Technical Analysis', url: 'https://www.investopedia.com/terms/t/technicalanalysis.asp', desc: 'Introduction to support/resistance, trend lines, and chart patterns.' },
                  { title: 'BabyPips: Technical Analysis Course', url: 'https://www.babypips.com/learn/forex/technical-analysis', desc: 'Free structured course covering candlesticks, indicators, and chart reading from scratch.' },
                  { title: 'TradingView: Pine Script & Chart Education', url: 'https://www.tradingview.com/education/', desc: "TradingView's own education hub — video tutorials, chart pattern guides, and indicator explanations." },
                ]} />

                <H2>Journaling and performance review</H2>
                <P>The traders who improve fastest are those who review their trades consistently and honestly.</P>
                <ResourceList resources={[
                  { title: 'Why You Need a Trading Journal', url: 'https://www.investopedia.com/articles/forex/11/why-you-need-a-forex-trading-journal.asp', desc: 'An overview of the benefits of keeping a trading journal and how to get started.' },
                  { title: 'Trading Journal: A Complete Guide', url: 'https://traderlion.com/foundations/keeping-a-trading-journal/', desc: 'A comprehensive guide to building and maintaining an effective trading journal.' },
                  ]} />

                <H2>Understanding your metrics</H2>
                <P>The numbers CogentLog shows are only useful if you understand what they mean.</P>
                <ResourceList resources={[
                  { title: 'What is a Good Profit Factor?', url: 'https://traderssecondbrain.com/guides/what-is-good-profit-factor', desc: 'Learn what constitutes a good profit factor and how to improve yours.' },
                  { title: 'Investopedia: Maximum Drawdown', url: 'https://www.investopedia.com/terms/m/maximum-drawdown-mdd.asp', desc: 'Understanding drawdown, why it matters more than total profit, and how to manage it.' },
                  { title: 'Investopedia: Risk-Reward Ratio', url: 'https://www.investopedia.com/terms/r/riskrewardratio.asp', desc: 'Learn about the risk-reward ratio and how to use it effectively in your trading.' },
                  { title: 'Investopedia: Win Rate and Risk-Reward', url: 'https://www.investopedia.com/articles/trading/02/020502.asp', desc: 'The relationship between win rate and risk-reward ratio — why a 40% win rate can still be very profitable.' },
                ]} />

                <Callout color="lime">
                  <Strong>Recommended starting point:</Strong> Read the BabyPips Money Management and Psychology courses in order. They are free, well-written, and cover everything a beginner needs before worrying about strategy.
                </Callout>
              </Section>
            )}

          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .help-layout {
            grid-template-columns: 1fr !important;
          }
          .help-layout > div:first-child {
            position: static !important;
          }
        }
      `}</style>
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────── */

function Section({ title, children }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute',
        left: '-12px',
        top: '6px',
        width: '4px',
        height: '20px',
        background: 'var(--accent-lime)',
        borderRadius: '4px',
      }} />
      <h2 style={{
        fontSize: '1.35rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        margin: '0 0 1.25rem',
        letterSpacing: '-0.02em',
      }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {children}
      </div>
    </div>
  )
}

function H2({ children }) {
  return (
    <h3 style={{
      fontSize: '1rem',
      fontWeight: '600',
      color: 'var(--text-main)',
      margin: '0.5rem 0 0',
      borderTop: '1px solid var(--border-subtle)',
      paddingTop: '1rem',
    }}>
      {children}
    </h3>
  )
}

function P({ children }) {
  return <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.75, margin: 0 }}>{children}</p>
}

function Strong({ children, style: s }) {
  return <strong style={{ color: 'var(--text-main)', fontWeight: '700', ...s }}>{children}</strong>
}

function Note({ children }) {
  return (
    <div style={{
      background: 'var(--bg-glass)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '0.83rem',
      color: 'var(--text-muted)',
      lineHeight: 1.65,
    }}>
      <strong style={{ color: 'var(--text-main)' }}>Note: </strong>{children}
    </div>
  )
}

function Callout({ children, color = 'lime' }) {
  const map = {
    lime: {
      bg: 'var(--accent-lime-glow)',
      border: 'var(--border-accent)',
      glow: 'var(--glow-lime)',
    },
    amber: {
      bg: 'var(--accent-amber-dim)',
      border: 'rgba(245,159,0,0.3)',
      glow: '0 0 0 1px rgba(245,159,0,0.2)',
    },
  }
  const c = map[color]
  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: '10px',
      padding: '16px 18px',
      fontSize: '0.88rem',
      color: 'var(--text-main)',
      lineHeight: 1.7,
      boxShadow: c.glow,
    }}>
      {children}
    </div>
  )
}

function Steps({ steps }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {steps.map(({ n, title, body }) => (
        <div key={n} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'var(--accent-lime-dim)', border: '1px solid rgba(200,241,53,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.78rem', fontWeight: '700', color: 'var(--accent-lime)',
            flexShrink: 0, marginTop: '1px',
          }}>
            {n}
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '3px' }}>{title}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>{body}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function FieldTable({ fields }) {
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
      {fields.map(({ name, desc }, i) => (
        <div key={name} style={{
          display: 'grid',
          gridTemplateColumns: '160px 1fr',
          gap: '0',
          borderBottom: i < fields.length - 1 ? '1px solid var(--border-subtle)' : 'none',
        }}>
          <div style={{
            padding: '10px 14px',
            fontSize: '0.82rem', fontWeight: '600', color: 'var(--accent-lime)',
            background: 'rgba(200,241,53,0.04)',
            borderRight: '1px solid var(--border-subtle)',
          }}>
            {name}
          </div>
          <div style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            {desc}
          </div>
        </div>
      ))}
    </div>
  )
}

function ResourceList({ resources }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {resources.map(({ title, url, desc }) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '14px 18px',
            textDecoration: 'none',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent-lime)'
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = 'var(--shadow-hover)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--accent-lime)', marginBottom: '3px' }}>
            {title} ↗
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            {desc}
          </div>
        </a>
      ))}
    </div>
  )
}