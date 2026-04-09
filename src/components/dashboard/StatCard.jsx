/**
 * StatCard
 * Props:
 *   title      — string label shown above value
 *   value      — formatted string (currency, %, number)
 *   isNegative — forces red colouring regardless of value
 *   hint       — optional tooltip text for the ⓘ icon
 *   children   — optional: replaces the value area entirely (for gauges etc.)
 */
export default function StatCard({ title, value, isNegative = false, hint, children }) {
  // Auto-detect negative from string if isNegative not explicitly set
  const negative = isNegative || (typeof value === 'string' && value.startsWith('-'))

  const valueColor = negative ? '#f03e3e' : 'var(--text-main)'

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: 'var(--card-shadow)',
      transition: 'border-color 0.15s, background 0.15s',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border-hover)'
        e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-color)'
        e.currentTarget.style.backgroundColor = 'var(--bg-card)'
      }}
    >
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          fontWeight: '500',
          letterSpacing: '0.01em',
        }}>
          {title}
        </span>
        {hint && (
          <span
            title={hint}
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-subtle)',
              cursor: 'help',
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            ⓘ
          </span>
        )}
      </div>

      {/* Value or custom children */}
      {children ? (
        <div style={{ flex: 1 }}>{children}</div>
      ) : (
        <span style={{
          fontSize: '1.45rem',
          fontWeight: '700',
          color: valueColor,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}>
          {value ?? '—'}
        </span>
      )}
    </div>
  )
}