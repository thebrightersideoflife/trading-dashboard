import { useState, useEffect } from 'react'
import { supabase } from '../../api/supabaseClient'

export default function LoadingScreen({ message = 'Loading...', minHeight = '60vh', inline = false }) {
  const [themeColor, setThemeColor] = useState('var(--accent-lime)')

  useEffect(() => {
    async function fetchThemeColor() {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('theme_color')
          .maybeSingle()
        if (profile?.theme_color) {
          setThemeColor(profile.theme_color)
        }
      } catch (err) {
        console.warn('Could not load profile theme_color:', err)
      }
    }
    fetchThemeColor()
  }, [])

  const content = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: inline ? '40px 20px' : '50px 24px',
        width: '100%',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @keyframes globalLoadingSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes globalLoadingGlow {
          0%, 100% { opacity: 0.18; transform: scale(1); }
          50% { opacity: 0.38; transform: scale(1.18); }
        }
        @keyframes globalMessageFade {
          0% {
            opacity: 0;
            transform: translateY(6px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Branded System Logo with theme color glow */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            backgroundColor: themeColor,
            filter: 'blur(24px)',
            animation: 'globalLoadingGlow 2.2s ease-in-out infinite',
          }}
        />
        <img
          src="/CogentLog_Logo_2.png"
          alt="CogentLog"
          style={{
            height: '38px',
            width: 'auto',
            position: 'relative',
            zIndex: 2,
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))',
          }}
        />
      </div>

      {/* Theme Color Spinner */}
      <div
        style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(255,255,255,0.08)',
          borderTopColor: themeColor,
          borderRadius: '50%',
          animation: 'globalLoadingSpin 0.8s linear infinite',
          marginBottom: '16px',
        }}
      />

      {/* Message with Keyframe Fade-In & Slide Animation */}
      {message && (
        <div
          key={message}
          style={{
            fontSize: '0.95rem',
            fontWeight: '600',
            color: 'var(--text-main, #fff)',
            letterSpacing: '-0.01em',
            textAlign: 'center',
            animation: 'globalMessageFade 0.45s ease-out forwards',
          }}
        >
          {message}
        </div>
      )}
    </div>
  )

  if (inline) return content

  return (
    <div
      className="dashboard-container"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight,
        width: '100%',
      }}
    >
      {content}
    </div>
  )
}
