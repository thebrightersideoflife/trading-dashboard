import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';
import { TrendingUp, Trophy, BarChart3, Clock, Calendar } from 'lucide-react';

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

  const dropdownRef = useRef(null);

  // Analytics insights cycling state
  const [insights, setInsights] = useState([]);
  const [insightIndex, setInsightIndex] = useState(0);
  const [fade, setFade] = useState(true);

  // Fetch light database metrics on mount or location view shifts
  useEffect(() => {
    if (!user) return;
    const fetchHeaderMetrics = async () => {
      try {
        const isDemo = profile?.show_demo_data ?? true;
        const targetView = isDemo ? 'dashboard_metrics' : 'dashboard_metrics_real';
        const { data } = await supabase.from(targetView).select('*').maybeSingle();

        const list = [];
        // 1. Personal Greeting
        const displayName = profile?.preferred_name?.trim() || user?.email?.split('@')[0];
        list.push({ type: 'greeting', text: `👋 Hi, ${displayName}` });

        if (data) {
          // 2. Win Rate
          if (data.win_rate != null) {
            list.push({ type: 'winRate', text: `Win Rate: ${Number(data.win_rate).toFixed(1)}%` });
          }
          // 3. Best Trade
          if (data.best_trade != null) {
            const currencySymbol = profile?.currency === 'EUR' ? '€' : profile?.currency === 'GBP' ? '£' : '$';
            list.push({ type: 'bestTrade', text: `Best Trade: +${currencySymbol}${Number(data.best_trade).toLocaleString()}` });
          }
          // 4. Total Trades Count
          if (data.total_trades) {
            list.push({ type: 'execution', text: `Execution: ${data.total_trades} Trades Logged` });
          }
        }

        // ── 5. Fetch all trades to derive Timing Edge Analysis (Best/Worst hours & days) ──
        const baseTradesView = isDemo ? 'trades' : 'trades'; // table source
        let { data: rawTrades } = await supabase
          .from(baseTradesView)
          .select('close_time, realized_pnl, is_mock')
          .not('close_time', 'is', null)
          .not('realized_pnl', 'is', null);

        if (!isDemo && rawTrades) {
          rawTrades = rawTrades.filter(t => !t.is_mock);
        }

        if (rawTrades && rawTrades.length > 0) {
          // Compute Day of Week edge
          const DAYS_LOOKUP = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const dowMap = {};
          // Compute Hour edge
          const hourMap = {};

          rawTrades.forEach(t => {
            const dateObj = new Date(t.close_time);
            const pnl = Number(t.realized_pnl);

            const dayName = DAYS_LOOKUP[dateObj.getDay()];
            if (!dowMap[dayName]) dowMap[dayName] = 0;
            dowMap[dayName] += pnl;

            const hourNum = dateObj.getHours();
            if (!hourMap[hourNum]) hourMap[hourNum] = 0;
            hourMap[hourNum] += pnl;
          });

          // Derive best/worst items
          const dowEntries = Object.entries(dowMap);
          if (dowEntries.length > 0) {
            const sortedDays = [...dowEntries].sort((a, b) => b[1] - a[1]);
            list.push({ type: 'bestDay', text: `Best Day: ${sortedDays[0][0]}` });
            if (sortedDays.length > 1 && sortedDays[sortedDays.length - 1][1] < 0) {
              list.push({ type: 'worstDay', text: `Worst Day: ${sortedDays[sortedDays.length - 1][0]}` });
            }
          }

          const hourEntries = Object.entries(hourMap);
          if (hourEntries.length > 0) {
            const sortedHours = [...hourEntries].sort((a, b) => b[1] - a[1]);
            const formatHour = (h) => {
              const num = parseInt(h);
              if (num === 0) return '12 AM';
              if (num === 12) return '12 PM';
              return num > 12 ? `${num - 12} PM` : `${num} AM`;
            };
            list.push({ type: 'bestHour', text: `Best Hour: ${formatHour(sortedHours[0][0])}` });
            if (sortedHours.length > 1 && sortedHours[sortedHours.length - 1][1] < 0) {
              list.push({ type: 'worstHour', text: `Worst Hour: ${formatHour(sortedHours[sortedHours.length - 1][0])}` });
            }
          }
        }

        setInsights(list);
      } catch (err) {
        console.error('Header metrics err:', err);
      }
    };
    fetchHeaderMetrics();
  }, [user, profile?.preferred_name, profile?.show_demo_data, profile?.currency, location.pathname]);

  // Interval rotation loop
  useEffect(() => {
    if (insights.length <= 1) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setInsightIndex((prev) => (prev + 1) % insights.length);
        setFade(true);
      }, 300); // match fade transition duration smoothly
    }, 7000);
    return () => clearInterval(interval);
  }, [insights]);

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
      <div
        style={{ display: 'flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer' }}
        onClick={() => navigate('/dashboard')}
      >
        <img
          src="/CogentLog_Logo_2.png"
          alt="CogentLog"
          style={{ height: '28px', width: 'auto', display: 'block' }}
        />
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

      {/* Dynamic Personal Header Analytics Insight Banner */}
      <div
        onClick={() => {
          if (insights.length === 0) return;
          const item = insights[insightIndex];
          if (item.type === 'winRate' || item.type === 'bestTrade' || item.type === 'execution') {
            navigate('/analytics#edge');
          } else if (item.type === 'bestDay' || item.type === 'worstDay' || item.type === 'bestHour' || item.type === 'worstHour') {
            navigate('/analytics#timing');
          } else {
            navigate('/analytics#edge');
          }
        }}
        style={{
          fontSize: '0.88rem',
          fontWeight: '600',
          color: 'var(--text-muted)',
          marginRight: '12px',
          whiteSpace: 'nowrap',
          opacity: fade ? 1 : 0,
          transform: fade ? 'translateY(0)' : 'translateY(-1px)',
          transition: 'opacity 0.25s ease, transform 0.25s ease, color 0.15s ease',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          userSelect: 'none',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        className="header-insights-bar"
      >
        {(() => {
          if (insights.length === 0) {
            const displayName = profile?.preferred_name?.trim() || user?.email?.split('@')[0];
            return <span>👋 Hi, {displayName}</span>;
          }
          const item = insights[insightIndex];
          if (item.type === 'greeting') {
            return <span>{item.text}</span>;
          }
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {item.type === 'winRate' && <TrendingUp size={14} style={{ color: 'var(--accent-lime)' }} />}
              {item.type === 'bestTrade' && <Trophy size={14} style={{ color: 'var(--accent-amber, #f59f00)' }} />}
              {item.type === 'execution' && <BarChart3 size={14} style={{ color: 'var(--accent-blue, #4dabf7)' }} />}
              {(item.type === 'bestDay' || item.type === 'worstDay') && <Calendar size={14} style={{ color: item.type === 'bestDay' ? 'var(--accent-lime)' : 'var(--color-loss)' }} />}
              {(item.type === 'bestHour' || item.type === 'worstHour') && <Clock size={14} style={{ color: item.type === 'bestHour' ? 'var(--accent-lime)' : 'var(--color-loss)' }} />}
              <span>{item.text}</span>
            </div>
          );
        })()}
      </div>

      {/* Right: profile avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }} ref={dropdownRef}>
        <button
          onClick={() => setProfileOpen(o => !o)}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: profile?.avatar_url ? 'transparent' : (profile?.theme_color || 'var(--accent-lime)'),
            border: profile?.avatar_url ? '1px solid var(--border-color)' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            fontWeight: '700',
            color: '#0a0a0f',
            overflow: 'hidden',
            padding: 0,
          }}
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Avatar"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => {
                e.target.style.display = 'none';
                e.currentTarget.parentElement.style.background = profile?.theme_color || 'var(--accent-lime)';
                e.currentTarget.parentElement.innerText = userInitial;
              }}
            />
          ) : userInitial}
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
                background: profile?.avatar_url ? 'transparent' : (profile?.theme_color || 'var(--accent-lime)'),
                border: profile?.avatar_url ? '1px solid var(--border-color)' : 'none',
                display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: '700', color: '#0a0a0f', flexShrink: 0,
                overflow: 'hidden',
              }}>
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => {
                      e.target.style.display = 'none';
                      e.currentTarget.parentElement.style.background = profile?.theme_color || 'var(--accent-lime)';
                      e.currentTarget.parentElement.innerText = userInitial;
                    }}
                  />
                ) : userInitial}
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