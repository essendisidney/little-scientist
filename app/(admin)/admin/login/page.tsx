'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    setError('')
    setLoading(true)
    const { error: e } = await supabase.auth.signInWithPassword({ email, password })
    if (e) {
      setError(e.message)
      setLoading(false)
    } else router.replace('/admin/dashboard')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #08081a; }
      `}</style>
      <div
        style={{
          minHeight: '100vh',
          background: '#08081a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Nunito, sans-serif',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20,
            padding: 40,
            width: '100%',
            maxWidth: 400,
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#ff5e1a,#ffb347)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                margin: '0 auto 12px',
              }}
            >
              🔬
            </div>
            <div style={{ fontWeight: 900, fontSize: 20, color: '#fff' }}>Admin Login</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
              Little Scientist Venue OS
            </div>
          </div>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              display: 'block',
              width: '100%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              padding: '14px 16px',
              color: '#fff',
              fontSize: 15,
              marginBottom: 12,
              fontFamily: 'Nunito, sans-serif',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              display: 'block',
              width: '100%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              padding: '14px 16px',
              color: '#fff',
              fontSize: 15,
              marginBottom: 16,
              fontFamily: 'Nunito, sans-serif',
            }}
          />
          {error && (
            <div
              style={{
                color: '#f87171',
                fontSize: 13,
                marginBottom: 12,
                padding: '10px 14px',
                background: 'rgba(248,113,113,0.08)',
                borderRadius: 8,
              }}
            >
              {error}
            </div>
          )}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              display: 'block',
              width: '100%',
              background: 'linear-gradient(135deg,#ff5e1a,#ff8c42)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '15px',
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'Nunito, sans-serif',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>
        </div>
      </div>
    </>
  )
}
