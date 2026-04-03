import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function ProtectedRoute({ children }) {
  // Destructure 'loading' from your hook
  const { user, loading } = useAuth()

  // 1. While checking the session, show a loading state 
  // This prevents the immediate "null user" redirect
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <p>Loading session...</p>
      </div>
    )
  }

  // 2. Only redirect if loading is finished and NO user was found
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}