import { Navigate } from 'react-router-dom'

/**
 * ProtectedRoute
 *
 * Wraps a route so that unauthenticated users are redirected to /login.
 * Must receive sessionReady so it never redirects while Supabase is still
 * restoring the session from localStorage (which would cause a false logout).
 *
 * Usage in App.jsx:
 *   <Route path="/dashboard" element={
 *     <ProtectedRoute sessionReady={sessionReady} user={user}>
 *       <Dashboard />
 *     </ProtectedRoute>
 *   } />
 *
 * NOTE: App.jsx already handles this inline — you can use either approach,
 * but not both. If App.jsx uses this component, remove the inline guard there.
 */
export default function ProtectedRoute({ user, sessionReady, children }) {
  // Still waiting for supabase.auth.getSession() to resolve — render nothing
  // (prevents a redirect to /login on hard refresh before session is restored)
  if (!sessionReady) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-main)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '2px solid var(--border-color)',
          borderTopColor: 'var(--accent-lime)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Session resolved but no user — redirect
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Authenticated
  return children
}