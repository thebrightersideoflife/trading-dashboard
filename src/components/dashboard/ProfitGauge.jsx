/**
 * ProfitGauge
 * Props:
 *   value       — drawdown_from_target (e.g. -30.3 means 30.3% below target)
 *   target      — profit_target_pct (e.g. 30 means 30% profit target)
 *
 * The gauge spans from –target (max loss zone) to +target (goal reached).
 * The needle sits at `value` clamped within that range.
 * Colour sweeps red → amber → lime across the arc.
 */
export default function ProfitGauge({ value = 0, target = 30 }) {
  const SIZE     = 160
  const CX       = SIZE / 2
  const CY       = SIZE / 2 + 10        // shift centre down so arc fills the card better
  const R        = 58
  const STROKE   = 10

  // Arc runs from 180° (left) to 0° (right) — a true semi-circle
  const START_ANGLE = 180   // left  = worst
  const END_ANGLE   = 0     // right = best (but we flip: left=neg, right=pos)

  // Map value to angle: clamp value between -target and +target
  const clamped  = Math.max(-target, Math.min(target, value ?? 0))
  // Fraction 0 (worst) → 1 (best)
  const fraction = (clamped + target) / (target * 2)
  // Needle angle: 180° → 0° as fraction goes 0 → 1
  const needleAngleDeg = 180 - fraction * 180

  // ── Arc path helpers ────────────────────────────────────────────
  function polarToXY(angleDeg, r = R) {
    const rad = (angleDeg * Math.PI) / 180
    return {
      x: CX + r * Math.cos(Math.PI - rad),   // flip so 0° is right
      y: CY - r * Math.sin(rad),
    }
  }

  function describeArc(startDeg, endDeg, r = R) {
    const s    = polarToXY(startDeg, r)
    const e    = polarToXY(endDeg, r)
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  // Full background arc (grey track)
  const trackPath = describeArc(0, 180)

  // Filled arc up to needle position (0° → needleAngleDeg)
  const fillPath = needleAngleDeg > 0 ? describeArc(0, needleAngleDeg) : ''

  // Needle tip
  const needleTip  = polarToXY(needleAngleDeg, R - 2)
  const needleBase = polarToXY(needleAngleDeg, 10)

  // Label colour: red if negative, lime if positive/zero
  const isNeg       = (value ?? 0) < 0
  const displayVal  = value != null ? `${value > 0 ? '+' : ''}${value.toFixed(1)}%` : '—'
  const labelColor  = isNeg ? 'var(--color-loss)' : 'var(--accent-lime)'

  // Gradient id — unique per instance via a static key (fine for single use)
  const gradId = 'gaugeGrad'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      minHeight: '90px',
    }}>
      <svg
        width={SIZE}
        height={SIZE / 2 + 28}
        viewBox={`0 ${CY - R - STROKE} ${SIZE} ${R + STROKE + 28}`}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Red → amber → lime sweep across the arc */}
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="var(--gauge-start, #f03e3e)" />
            <stop offset="50%"  stopColor="var(--gauge-mid,   #f5a623)" />
            <stop offset="100%" stopColor="var(--gauge-end,   #c8f135)" />
          </linearGradient>
        </defs>

        {/* Track (background arc) */}
        <path
          d={trackPath}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Coloured fill arc */}
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        )}

        {/* Needle */}
        <line
          x1={needleBase.x}
          y1={needleBase.y}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="var(--text-main, #e8e8f0)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Needle pivot dot */}
        <circle cx={CX} cy={CY} r={4} fill="var(--text-main, #e8e8f0)" />

        {/* Centre label */}
        <text
          x={CX}
          y={CY + 18}
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

      {/* Sub-label */}
      <span style={{
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        marginTop: '-2px',
        letterSpacing: '0.02em',
      }}>
        Target: {target}%
      </span>
    </div>
  )
}