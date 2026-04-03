import { useState, useEffect } from 'react'
import { supabase } from '../../api/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const navigate = useNavigate()
  const { user } = useAuth()

  // ✅ ONLY redirect here. This prevents double-navigation conflicts.
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // No navigate here; the useEffect above handles it once 'user' is set.
  }

  const handleSignup = async () => {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: email // matches your handle_new_user function logic [cite: 27]
        }
      }
    })

    if (error) {
      setError(error.message)
    } else {
      alert('Signup successful! Check your email for confirmation.')
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <form onSubmit={handleLogin} className="bg-gray-800 p-6 rounded-xl w-80 space-y-4 shadow-2xl">
        <h2 className="text-xl font-bold text-center">Trading Dashboard</h2>

        <div className="space-y-1">
          <label className="text-sm text-gray-400">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-gray-400">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none"
            required
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button 
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded font-semibold transition"
        >
          {loading ? 'Processing...' : 'Login'}
        </button>

        <button
          type="button"
          onClick={handleSignup}
          disabled={loading}
          className="w-full bg-transparent border border-green-600 text-green-500 hover:bg-green-600 hover:text-white p-2 rounded font-semibold transition"
        >
          Create Account
        </button>
      </form>
    </div>
  )
}