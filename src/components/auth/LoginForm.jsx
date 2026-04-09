import { useState } from 'react';
import { supabase } from '../../api/supabaseClient';

export default function LoginForm() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async () => {
    setError('');
    setSuccessMsg('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setSuccessMsg('Account created! Check your email to confirm your address, then log in.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-main)',
    fontSize: '14px',
    padding: '11px 14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-main)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'DM Sans', 'Inter', sans-serif",
    }}>
      {/* Subtle background accent */}
      <div style={{
        position: 'fixed',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(200,241,53,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '400px',
      }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '10px',
          }}>
            {/* Lime accent mark */}
            <div style={{
              width: '8px',
              height: '28px',
              background: 'var(--accent-lime)',
              borderRadius: '4px',
            }} />
            <span style={{
              fontSize: '22px',
              fontWeight: '700',
              color: 'var(--text-main)',
              letterSpacing: '-0.5px',
            }}>
              Trading Dashboard
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px',
        }}>
          {/* Tab switcher */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-main)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px',
            marginBottom: '28px',
            gap: '4px',
          }}>
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccessMsg(''); }}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  background: mode === m ? 'var(--bg-card)' : 'transparent',
                  color: mode === m ? 'var(--text-main)' : 'var(--text-muted)',
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                {m === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500', letterSpacing: '0.3px' }}>
                EMAIL
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-lime)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500', letterSpacing: '0.3px' }}>
                PASSWORD
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-lime)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500', letterSpacing: '0.3px' }}>
                  CONFIRM PASSWORD
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent-lime)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                />
              </div>
            )}
          </div>

          {/* Error / success */}
          {error && (
            <div style={{
              marginTop: '16px',
              padding: '10px 14px',
              background: 'rgba(240,62,62,0.1)',
              border: '1px solid rgba(240,62,62,0.25)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-loss)',
              fontSize: '13px',
            }}>
              {error}
            </div>
          )}
          {successMsg && (
            <div style={{
              marginTop: '16px',
              padding: '10px 14px',
              background: 'rgba(200,241,53,0.08)',
              border: '1px solid rgba(200,241,53,0.2)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-lime)',
              fontSize: '13px',
            }}>
              {successMsg}
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              marginTop: '24px',
              padding: '12px',
              background: loading ? 'rgba(200,241,53,0.5)' : 'var(--accent-lime)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: '#0a0a0f',
              fontSize: '14px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '0.3px',
              transition: 'opacity 0.2s, transform 0.1s',
            }}
            onMouseEnter={(e) => { if (!loading) e.target.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.target.style.opacity = '1'; }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}