/**
 * Footer
 * Minimal footer showing brand name and copyright.
 * Sits inside AppLayout below <main>.
 */
export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border-color)',
      padding: '16px 28px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: 'var(--bg-main)',
      flexWrap: 'wrap',
      gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '5px', height: '18px', background: 'var(--accent-lime)', borderRadius: '2px' }} />
        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
          CogentLog
        </span>
      </div>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        © {new Date().getFullYear()} CogentLog. All rights reserved.
      </span>
    </footer>
  )
}