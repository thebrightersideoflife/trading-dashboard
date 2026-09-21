import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './api/supabaseClient';
import LoginForm    from './components/auth/LoginForm';
import Header       from './components/layout/Header';
import Dashboard    from './components/dashboard/Dashboard';
import CalendarPage from './components/calendar/CalendarPage';
import ProfilePage  from './components/profile/ProfilePage.jsx';
import TradesPage     from './components/trades/TradesPage.jsx';
import AnalyticsPage  from './components/analytics/AnalyticsPage.jsx';
import JournalPage    from './components/journal/JournalPage.jsx';
import HelpPage       from './components/help/HelpPage.jsx';
import Footer         from './components/layout/Footer.jsx';

function AppLayout({ user, profile, onProfileUpdate, showDemoData, onToggleDemoData, children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}>
      <Header
        user={user}
        profile={profile}
        onProfileUpdate={onProfileUpdate}
        showMockData={showDemoData}
        onToggleMockData={onToggleDemoData}
      />
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function ProtectedRoute({ user, sessionReady, children }) {
  if (!sessionReady) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-main)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '32px', height: '32px',
          border: '2px solid var(--border-color)',
          borderTopColor: 'var(--accent-lime)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user,         setUser]         = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [sessionReady, setSessionReady] = useState(false);

  // showDemoData lives in App — not inside Dashboard's hook —
  // so the toggle works from ProfilePage, Header, or any route.
  // Seeded from profiles.show_demo_data on login, persisted on toggle.
  const [showDemoData, setShowDemoData] = useState(true);

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setSessionReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Profile fetch — seeds showDemoData from Postgres
  useEffect(() => {
    if (!user) { setProfile(null); return; }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setProfile(data);
        setShowDemoData(data.show_demo_data ?? true);

        // Inject dynamic theme color CSS variable globally into the document root
        if (data.theme_color) {
          document.documentElement.style.setProperty('--accent-lime', data.theme_color);

          // Compute secondary variations if hex matches basic pattern to update related glows/dim rings
          if (/^#[0-9A-F]{6}$/i.test(data.theme_color)) {
            const r = parseInt(data.theme_color.slice(1, 3), 16);
            const g = parseInt(data.theme_color.slice(3, 5), 16);
            const b = parseInt(data.theme_color.slice(5, 7), 16);
            document.documentElement.style.setProperty('--accent-lime-rgb', `${r}, ${g}, ${b}`);
            document.documentElement.style.setProperty('--accent-lime-glow', `rgba(${r}, ${g}, ${b}, 0.08)`);
            document.documentElement.style.setProperty('--accent-lime-dim', `rgba(${r}, ${g}, ${b}, 0.16)`);
            document.documentElement.style.setProperty('--color-profit', data.theme_color);
            document.documentElement.style.setProperty('--chart-line', data.theme_color);
          }
        }
      });
  }, [user]);

  const handleProfileUpdate = useCallback((updated) => {
    if (!updated) return;
    setProfile(updated);
    if (updated.show_demo_data != null) setShowDemoData(updated.show_demo_data);

    if (updated.theme_color) {
      document.documentElement.style.setProperty('--accent-lime', updated.theme_color);
      if (/^#[0-9A-F]{6}$/i.test(updated.theme_color)) {
        const r = parseInt(updated.theme_color.slice(1, 3), 16);
        const g = parseInt(updated.theme_color.slice(3, 5), 16);
        const b = parseInt(updated.theme_color.slice(5, 7), 16);
        document.documentElement.style.setProperty('--accent-lime-rgb', `${r}, ${g}, ${b}`);
        document.documentElement.style.setProperty('--accent-lime-glow', `rgba(${r}, ${g}, ${b}, 0.08)`);
        document.documentElement.style.setProperty('--accent-lime-dim', `rgba(${r}, ${g}, ${b}, 0.16)`);
        document.documentElement.style.setProperty('--color-profit', updated.theme_color);
        document.documentElement.style.setProperty('--chart-line', updated.theme_color);
      }
    }
  }, []);

  // Toggle — App-level so it works on any route without Dashboard being mounted
  const handleToggleDemoData = useCallback(async () => {
    if (!user) return;
    const next = !showDemoData;
    setShowDemoData(next); // optimistic
    const { error } = await supabase
      .from('profiles')
      .update({ show_demo_data: next })
      .eq('id', user.id);
    if (error) {
      console.error('[toggleDemoData]', error);
      setShowDemoData(!next); // rollback on failure
    }
  }, [showDemoData, user]);

  const layout = (children) => (
    <AppLayout
      user={user}
      profile={profile}
      onProfileUpdate={handleProfileUpdate}
      showDemoData={showDemoData}
      onToggleDemoData={handleToggleDemoData}
    >
      {children}
    </AppLayout>
  );

  const themeColor = profile?.theme_color || '#25D366';
  const cleanHex = themeColor.replace('#', '');
  const rChan = parseInt(cleanHex.substring(0, 2), 16) || 37;
  const gChan = parseInt(cleanHex.substring(2, 4), 16) || 211;
  const bChan = parseInt(cleanHex.substring(4, 6), 16) || 102;
  const rgbChannels = `${rChan}, ${gChan}, ${bChan}`;

  return (
    <div style={{
      '--accent-lime': themeColor,
      '--accent-lime-rgb': rgbChannels,
      minHeight: '100vh',
    }}>
      <BrowserRouter>
        <Routes>

        <Route
          path="/login"
          element={
            sessionReady && user
              ? <Navigate to="/dashboard" replace />
              : <LoginForm />
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={user} sessionReady={sessionReady}>
              {layout(
                <Dashboard
                  sessionReady={sessionReady}
                  showDemoData={showDemoData}
                />
              )}
            </ProtectedRoute>
          }
        />

        <Route
          path="/calendar"
          element={
            <ProtectedRoute user={user} sessionReady={sessionReady}>
              {layout(
                <CalendarPage sessionReady={sessionReady} profile={profile} showDemoData={showDemoData} />
              )}
            </ProtectedRoute>
          }
        />

        <Route
          path="/trades"
          element={
            <ProtectedRoute user={user} sessionReady={sessionReady}>
              {layout(
                <TradesPage
                  sessionReady={sessionReady}
                  showDemoData={showDemoData}
                />
              )}
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute user={user} sessionReady={sessionReady}>
              {layout(
                <AnalyticsPage
                  sessionReady={sessionReady}
                  showDemoData={showDemoData}
                />
              )}
            </ProtectedRoute>
          }
        />

        <Route
          path="/journal"
          element={
            <ProtectedRoute user={user} sessionReady={sessionReady}>
              {layout(
                <JournalPage
                  sessionReady={sessionReady}
                  showDemoData={showDemoData}
                />
              )}
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute user={user} sessionReady={sessionReady}>
              {layout(
                <ProfilePage
                  user={user}
                  profile={profile}
                  onProfileUpdate={handleProfileUpdate}
                  showDemoData={showDemoData}
                  onToggleDemoData={handleToggleDemoData}
                />
              )}
            </ProtectedRoute>
          }
        />

        <Route
          path="/help"
          element={layout(<HelpPage />)}
        />

        <Route
          path="*"
          element={<Navigate to={user ? '/dashboard' : '/login'} replace />}
        />

      </Routes>
    </BrowserRouter>
    </div>
  );
}