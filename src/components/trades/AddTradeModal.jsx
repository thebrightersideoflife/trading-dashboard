import { useState } from 'react'
import { supabase } from '../../api/supabaseClient'

export default function AddTradeModal({ onClose, onTradeAdded }) {
  const [form, setForm] = useState({
    symbol: '',
    side: 'Buy',
    open_time: '',
    close_time: '',
    entry_price: '',
    exit_price: '',
    quantity: '',
    fees: '',
    swap: ''
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const realized_pnl =
      (parseFloat(form.exit_price) - parseFloat(form.entry_price)) *
        parseFloat(form.quantity) -
      (parseFloat(form.fees) || 0) -
      (parseFloat(form.swap) || 0)

    const { error } = await supabase.rpc('add_trade', {
      p_symbol:      form.symbol,
      p_side:        form.side,
      p_open_time:   form.open_time,
      p_close_time:  form.close_time,
      p_entry_price: Number(form.entry_price),
      p_exit_price:  Number(form.exit_price),
      p_quantity:    Number(form.quantity),
      p_fees:        Number(form.fees)  || 0,
      p_swap:        Number(form.swap)  || 0,
      p_realized_pnl: realized_pnl
    })

    if (error) {
      console.error(error)
      alert('Error adding trade')
    } else {
      onTradeAdded()
      onClose()
    }
    setLoading(false)
  }

  /* ── Shared input style ───────────────────────────────────────────── */
  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: '#0d0d12',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-main)',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const fieldStyle = { display: 'flex', flexDirection: 'column' }

  return (
    /* ── Backdrop ───────────────────────────────────────────────────── */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 1000,
      }}
    >
      {/* ── Modal ─────────────────────────────────────────────────── */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '28px',
          width: '100%',
          maxWidth: '460px',
          boxShadow: 'var(--card-shadow)',
          color: 'var(--text-main)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>Add Trade</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-muted)', fontSize: '1.25rem',
              cursor: 'pointer', lineHeight: 1, padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Symbol + Side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Symbol</label>
              <input
                name="symbol" placeholder="e.g. NAS100"
                onChange={handleChange} required
                style={inputStyle}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Side</label>
              <select
                name="side" onChange={handleChange}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
              </select>
            </div>
          </div>

          {/* Open / Close Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Open Time</label>
              <input
                type="datetime-local" name="open_time"
                onChange={handleChange} required
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Close Time</label>
              <input
                type="datetime-local" name="close_time"
                onChange={handleChange} required
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </div>
          </div>

          {/* Entry / Exit Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Entry Price</label>
              <input
                type="number" step="any" name="entry_price"
                placeholder="0.00" onChange={handleChange} required
                style={inputStyle}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Exit Price</label>
              <input
                type="number" step="any" name="exit_price"
                placeholder="0.00" onChange={handleChange} required
                style={inputStyle}
              />
            </div>
          </div>

          {/* Quantity / Fees / Swap */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Quantity</label>
              <input
                type="number" step="any" name="quantity"
                placeholder="0.01" onChange={handleChange} required
                style={inputStyle}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Fees</label>
              <input
                type="number" step="any" name="fees"
                placeholder="0.00" onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Swap</label>
              <input
                type="number" step="any" name="swap"
                placeholder="0.00" onChange={handleChange}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button" onClick={onClose}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              style={{
                padding: '10px 24px',
                backgroundColor: 'var(--accent-lime)',
                border: 'none',
                borderRadius: '8px',
                color: '#000',
                fontWeight: '700',
                fontSize: '0.875rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Adding...' : 'Add Trade'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}