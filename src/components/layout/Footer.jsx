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
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <img
          src="/CogentLog_Logo.png"
          alt="CogentLog"
          style={{ height: '20px', width: 'auto', display: 'block', opacity: 0.85 }}
        />
      </div>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        © {new Date().getFullYear()} CogentLog. All rights reserved.
      </span>
    </footer>
  )
}