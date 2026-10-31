import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';
import {
  TrendingUp, Trophy, BarChart3, Clock, Calendar,
  BookOpen, HelpCircle, LayoutDashboard, FileText, ArrowLeftRight, Plus
} from 'lucide-react';
import AddTradeModal from '../trades/AddTradeModal';
import ImportTradesModal from '../trades/ImportTradesModal';

const NAV_TABS = [
  { label: 'Dashboard', path: '/dashboard', available: true },
  { label: 'Calendar',  path: '/calendar',  available: true },
  { label: 'Trades',    path: '/trades',    available: true },
  { label: 'Analytics', path: '/analytics', available: true },
  { label: 'Journal',   path: '/journal',   available: true },
  { label: 'Notes',     path: '/notes',     available: true },
  { label: 'Help',      path: '/help',      available: true },
];

export default function Header({ profile, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);

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
        const baseTradesView = 'trades'; // table source
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

  // Responsive scroll listener: Collapse header on scroll down, reappear on scroll up
  useEffect(() => {
    let lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

    const handleScroll = () => {
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const delta = currentScrollY - lastScrollY;

      // Near top of page -> Keep header visible
      if (currentScrollY <= 40) {
        setHeaderVisible(true);
      }
      // Scrolling DOWN -> Collapse header
      else if (delta > 2) {
        setHeaderVisible(false);
        setProfileOpen(false);
      }
      // Scrolling UP -> Reappear header immediately regardless of scroll position
      else if (delta < -2) {
        setHeaderVisible(true);
      }

      lastScrollY = Math.max(0, currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const userEmail = user?.email || '';
  const userInitial = userEmail ? userEmail[0].toUpperCase() : '?';

  return (
    <>
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'rgba(10, 10, 15, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-color)',
        transform: headerVisible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* ── Main header row ── */}
        <div
          className="header-main-row"
          style={{
            height: '70px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 28px',
            gap: '24px',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand Logo */}
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

          {/* Desktop Nav tabs */}
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

          {/* Dynamic Personal Header Analytics Insight Banner (Desktop) */}
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

          {/* Mobile top header icons (Analytics, Journal, Help, Account) */}
          <div className="mobile-header-icons" style={{ display: 'none', alignItems: 'center', gap: '4px' }}>
            {/* Analytics */}
            <button
              onClick={() => navigate('/analytics')}
              aria-label="Analytics"
              title="Analytics"
              style={{
                width: '36px', height: '36px',
                borderRadius: '8px', border: 'none',
                background: location.pathname === '/analytics' ? 'var(--bg-card)' : 'transparent',
                color: location.pathname === '/analytics' ? 'var(--accent-lime)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              <BarChart3 size={20} strokeWidth={location.pathname === '/analytics' ? 2.3 : 1.8} />
            </button>

            {/* Journal */}
            <button
              onClick={() => navigate('/journal')}
              aria-label="Journal"
              title="Journal"
              style={{
                width: '36px', height: '36px',
                borderRadius: '8px', border: 'none',
                background: location.pathname === '/journal' ? 'var(--bg-card)' : 'transparent',
                color: location.pathname === '/journal' ? 'var(--accent-lime)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              <BookOpen size={20} strokeWidth={location.pathname === '/journal' ? 2.3 : 1.8} />
            </button>

            {/* Help */}
            <button
              onClick={() => navigate('/help')}
              aria-label="Help"
              title="Help"
              style={{
                width: '36px', height: '36px',
                borderRadius: '8px', border: 'none',
                background: location.pathname === '/help' ? 'var(--bg-card)' : 'transparent',
                color: location.pathname === '/help' ? 'var(--accent-lime)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              <HelpCircle size={20} strokeWidth={location.pathname === '/help' ? 2.3 : 1.8} />
            </button>
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
      </header>
      <div className="header-spacer" style={{ height: '70px' }} />

      {/* ── Mobile Bottom Navigation Bar (Mobile View Only) ── */}
      <nav
        className="mobile-bottom-nav"
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '66px',
          background: 'rgba(10, 10, 15, 0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid var(--border-color)',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 4px calc(env(safe-area-inset-bottom, 0px) + 2px)',
          zIndex: 999,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
        }}
      >
        {/* 1. Account Overview */}
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            background: 'none',
            border: 'none',
            color: location.pathname === '/dashboard' ? 'var(--accent-lime)' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px 0',
            fontFamily: 'inherit',
            transition: 'color 0.15s ease',
          }}
        >
          <LayoutDashboard size={20} strokeWidth={location.pathname === '/dashboard' ? 2.3 : 1.8} />
          <span style={{
            fontSize: '10px',
            fontWeight: location.pathname === '/dashboard' ? '600' : '400',
            letterSpacing: '0.1px',
            whiteSpace: 'nowrap',
          }}>
            Overview
          </span>
        </button>

        {/* 2. Calendar */}
        <button
          onClick={() => navigate('/calendar')}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            background: 'none',
            border: 'none',
            color: location.pathname === '/calendar' ? 'var(--accent-lime)' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px 0',
            fontFamily: 'inherit',
            transition: 'color 0.15s ease',
          }}
        >
          <Calendar size={20} strokeWidth={location.pathname === '/calendar' ? 2.3 : 1.8} />
          <span style={{
            fontSize: '10px',
            fontWeight: location.pathname === '/calendar' ? '600' : '400',
            letterSpacing: '0.1px',
            whiteSpace: 'nowrap',
          }}>
            Calendar
          </span>
        </button>

        {/* 3. Middle "+" Add Trade Circle */}
        <button
          onClick={() => setShowAddModal(true)}
          aria-label="Add Trade"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 0 4px 0',
            fontFamily: 'inherit',
          }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'var(--accent-lime)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0a0a0f',
            boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
            marginTop: '-14px',
            transition: 'transform 0.15s ease',
          }}>
            <Plus size={22} strokeWidth={2.8} />
          </div>
          <span style={{
            fontSize: '10px',
            fontWeight: '600',
            color: 'var(--accent-lime)',
            letterSpacing: '0.1px',
            whiteSpace: 'nowrap',
          }}>
            Add Trade
          </span>
        </button>

        {/* 4. Notes */}
        <button
          onClick={() => navigate('/notes')}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            background: 'none',
            border: 'none',
            color: location.pathname === '/notes' ? 'var(--accent-lime)' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px 0',
            fontFamily: 'inherit',
            transition: 'color 0.15s ease',
          }}
        >
          <FileText size={20} strokeWidth={location.pathname === '/notes' ? 2.3 : 1.8} />
          <span style={{
            fontSize: '10px',
            fontWeight: location.pathname === '/notes' ? '600' : '400',
            letterSpacing: '0.1px',
            whiteSpace: 'nowrap',
          }}>
            Notes
          </span>
        </button>

        {/* 5. Trades */}
        <button
          onClick={() => navigate('/trades')}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            background: 'none',
            border: 'none',
            color: location.pathname === '/trades' ? 'var(--accent-lime)' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px 0',
            fontFamily: 'inherit',
            transition: 'color 0.15s ease',
          }}
        >
          <ArrowLeftRight size={20} strokeWidth={location.pathname === '/trades' ? 2.3 : 1.8} />
          <span style={{
            fontSize: '10px',
            fontWeight: location.pathname === '/trades' ? '600' : '400',
            letterSpacing: '0.1px',
            whiteSpace: 'nowrap',
          }}>
            Trades
          </span>
        </button>
      </nav>

      {/* Global Add / Import Trade Modals from layout bottom bar */}
      {showAddModal && (
        <AddTradeModal
          onClose={() => setShowAddModal(false)}
          onTradeAdded={() => {
            window.dispatchEvent(new Event('tradeAdded'));
            setShowAddModal(false);
          }}
          onOpenImport={() => {
            setShowAddModal(false);
            setShowImportModal(true);
          }}
        />
      )}
      {showImportModal && (
        <ImportTradesModal
          onClose={() => setShowImportModal(false)}
          onTradesSaved={() => {
            window.dispatchEvent(new Event('tradeAdded'));
            setShowImportModal(false);
          }}
        />
      )}

      <style>{`
        .nav-tab-wrapper:hover .coming-soon-tooltip { opacity: 1 !important; }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .header-insights-bar { display: none !important; }
          .mobile-header-icons { display: flex !important; }
          .mobile-bottom-nav { display: flex !important; }
          .header-spacer { height: 60px !important; }
          .header-main-row {
            padding: 0 16px !important;
            height: 60px !important;
          }
        }
        @media (min-width: 769px) {
          .mobile-header-icons { display: none !important; }
          .mobile-bottom-nav { display: none !important; }
        }
      `}</style>
    </>
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