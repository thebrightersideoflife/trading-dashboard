/**
 * ProfitGauge
 * Props:
 *   value  — current % gain from initial balance (e.g. +31.1 or -1.9)
 *   target — profit_target_pct (e.g. 30)
 *
 * The full arc is always rendered red → amber → lime.
 * Only the needle moves — pointing left at worst, up at neutral, right at target.
 */
export default function ProfitGauge({ value = 0, target = 30 }) {
  const SIZE   = 160
  const CX     = SIZE / 2
  const CY     = SIZE / 2 + 10
  const R      = 58
  const STROKE = 10

  // Map value to needle angle
  // fraction 0 (worst: -target) → 1 (best: +target)
  const clamped        = Math.max(-target, Math.min(target, value ?? 0))
  const fraction       = (clamped + target) / (target * 2)
  // Angle: 180° = left (worst), 90° = up (neutral), 0° = right (best)
  const needleAngleDeg = 180 - fraction * 180

  function polarToXY(angleDeg, r = R) {
    const rad = (angleDeg * Math.PI) / 180
    return {
      x: CX + r * Math.cos(rad),
      y: CY - r * Math.sin(rad),
    }
  }

  // Full semi-circle arc path (always rendered, 180° → 0°)
  function fullArc(r = R) {
    const left  = polarToXY(180, r)
    const right = polarToXY(0,   r)
    // large-arc=1, sweep=0 (counter-clockwise) draws the top half
    // large-arc=0, sweep=1: clockwise small arc → passes through top
    return `M ${left.x} ${left.y} A ${r} ${r} 0 0 1 ${right.x} ${right.y}`
  }

  const needleTip = polarToXY(needleAngleDeg, R - 6)

  const isNeg      = (value ?? 0) < 0
  const displayVal = value != null ? `${value > 0 ? '+' : ''}${value.toFixed(1)}%` : '—'
  const labelColor = isNeg ? 'var(--color-loss)' : 'var(--accent-lime)'
  const gradId     = 'gaugeGradFull'

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      width:          '100%',
      height:         '100%',
      minHeight:      '90px',
    }}>
      <svg
        width={SIZE}
        height={SIZE / 2 + 30}
        viewBox={`0 ${CY - R - STROKE} ${SIZE} ${R + STROKE + 30}`}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Red (left/loss) → amber (centre) → lime (right/profit) */}
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#f03e3e" />
            <stop offset="50%"  stopColor="#f5a623" />
            <stop offset="100%" stopColor="#c8f135" />
          </linearGradient>
        </defs>

        {/* Dim track underneath for depth */}
        <path
          d={fullArc(R)}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={STROKE + 2}
          strokeLinecap="round"
        />

        {/* Full gradient arc — always fully visible */}
        <path
          d={fullArc(R)}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Needle — only this moves */}
        <line
          x1={CX}
          y1={CY}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="var(--text-main, #e8e8f0)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* Pivot dot on top of needle base */}
        <circle cx={CX} cy={CY} r={4.5} fill="var(--text-main, #e8e8f0)" />

        {/* Value label */}
        <text
          x={CX}
          y={CY + 20}
          textAnchor="middle"
          fontSize="15"
          fontWeight="700"
          fill={labelColor}
          fontFamily="inherit"
          letterSpacing="-0.5"
        >
          {displayVal}
        </text>
      </svg>

      <span style={{
        fontSize:      '0.7rem',
        color:         'var(--text-muted)',
        marginTop:     '-2px',
        letterSpacing: '0.02em',
      }}>
        Target: {target}%
      </span>
    </div>
  )
}