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
      });
  }, [user]);

  const handleProfileUpdate = useCallback((updated) => {
    if (!updated) return;
    setProfile(updated);
    if (updated.show_demo_data != null) setShowDemoData(updated.show_demo_data);
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

  return (
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
                <CalendarPage sessionReady={sessionReady} profile={profile} />
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
          path="*"
          element={<Navigate to={user ? '/dashboard' : '/login'} replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}