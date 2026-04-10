import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';

const NAV_TABS = [
  { label: 'Dashboard', path: '/dashboard', available: true },
  { label: 'Calendar',  path: '/calendar',  available: true },
  { label: 'Trades',    path: '/trades',    available: true },
  { label: 'Analytics', path: '/analytics', available: true },
  { label: 'Journal',   path: '/journal',   available: true },
  { label: 'Help',      path: '/help',      available: true },
];

export default function Header({ profile, user}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close mobile nav on route change
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const userEmail = user?.email || '';
  const userInitial = userEmail ? userEmail[0].toUpperCase() : '?';

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(10,10,15,0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-color)',
    }}>
      {/* ── Main header row ── */}
      <div style={{
        height: '70px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px',
        gap: '32px',
      }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <div style={{ width: '7px', height: '26px', background: 'var(--accent-lime)', borderRadius: '3px' }} />
        <span style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '-0.4px', whiteSpace: 'nowrap' }}>
          CogentLog
        </span>
      </div>

        {/* Hamburger — mobile only */}
        <button
          onClick={() => setMobileNavOpen(o => !o)}
          aria-label="Toggle navigation"
          style={{
            display: 'none',
            background: 'none', border: 'none',
            cursor: 'pointer', padding: '6px',
            color: 'var(--text-main)',
            flexShrink: 0,
          }}
          className="mobile-hamburger"
        >
          {mobileNavOpen
            ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            : <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          }
        </button>

      {/* Nav tabs — hidden on mobile, shown via dropdown */}
      <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
        {NAV_TABS.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <div key={tab.path} style={{ position: 'relative' }} className="nav-tab-wrapper">
              <button
                onClick={() => tab.available && navigate(tab.path)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isActive ? 'var(--bg-card)' : 'transparent',
                  color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                  fontSize: '14px',
                  fontWeight: isActive ? '600' : '400',
                  cursor: tab.available ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  transition: 'color 0.15s, background 0.15s',
                  position: 'relative',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (tab.available && !isActive) {
                    e.currentTarget.style.color = 'var(--text-main)';
                    e.currentTarget.style.background = 'var(--bg-card-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {tab.label}
                {isActive && (
                  <span style={{
                    position: 'absolute',
                    bottom: '-1px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '16px',
                    height: '2px',
                    background: 'var(--accent-lime)',
                    borderRadius: '1px',
                  }} />
                )}
              </button>

              {!tab.available && (
                <div className="coming-soon-tooltip" style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  opacity: 0,
                  transition: 'opacity 0.15s',
                  zIndex: 200,
                }}>
                  🚧 Coming soon
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Right: profile avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }} ref={dropdownRef}>
        <button
          onClick={() => setProfileOpen(o => !o)}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'var(--accent-lime)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            fontWeight: '700',
            color: '#0a0a0f',
          }}
        >
          {userInitial}
        </button>

        {profileOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '240px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 300,
            overflow: 'hidden',
          }}>
            {/* User info */}
            <div style={{
              padding: '14px 16px 12px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%',
                background: 'var(--accent-lime)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '15px', fontWeight: '700', color: '#0a0a0f', flexShrink: 0,
              }}>
                {userInitial}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userEmail}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {profile?.currency ?? 'USD'} · Target {profile?.profit_target ?? 30}%
                </div>
              </div>
            </div>

            <div style={{ padding: '8px' }}>
              {/* Profile settings link */}
              <MenuBtn
                icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.5 2L12 4.5L5 11.5H2.5V9L9.5 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>}
                onClick={() => { setProfileOpen(false); navigate('/profile'); }}
              >
                Edit Profile
              </MenuBtn>

              <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0 8px' }} />

              <MenuBtn
                icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2H2V12H5M9.5 9.5L12 7L9.5 4.5M12 7H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                onClick={handleLogout}
                danger
              >
                Log Out
              </MenuBtn>
            </div>
          </div>
        )}
      </div>

      </div>{/* end main header row */}

      {/* ── Mobile nav dropdown ── */}
      {mobileNavOpen && (
        <nav style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '8px 16px 16px',
          borderTop: '1px solid var(--border-color)',
          gap: '2px',
          background: 'rgba(10,10,15,0.97)',
        }}>
          {NAV_TABS.map(tab => {
            const isActive = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => { if (tab.available) { navigate(tab.path); setMobileNavOpen(false); } }}
                style={{
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? 'var(--bg-card)' : 'transparent',
                  color: isActive ? 'var(--accent-lime)' : tab.available ? 'var(--text-main)' : 'var(--text-muted)',
                  fontSize: '15px',
                  fontWeight: isActive ? '700' : '400',
                  cursor: tab.available ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  borderLeft: isActive ? '3px solid var(--accent-lime)' : '3px solid transparent',
                }}
              >
                {tab.label}{!tab.available ? ' 🚧' : ''}
              </button>
            );
          })}
        </nav>
      )}

      <style>{`
        .nav-tab-wrapper:hover .coming-soon-tooltip { opacity: 1 !important; }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-hamburger { display: flex !important; }
        }
      `}</style>
    </header>
  );
}

function MenuBtn({ children, icon, onClick, danger }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        padding: '8px 12px',
        background: hovered ? (danger ? 'rgba(240,62,62,0.08)' : 'var(--bg-card-hover)') : 'transparent',
        border: 'none',
        borderRadius: '6px',
        color: danger ? 'var(--color-loss)' : 'var(--text-main)',
        fontSize: '13px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'background 0.15s',
      }}
    >
      {icon}
      {children}
    </button>
  );
}