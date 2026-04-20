'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/admin/dashboard', label: '📊 Dashboard' },
  { href: '/admin/verify', label: '📷 Gate Verify' },
  { href: '/admin/invenue', label: '🛍️ In-Venue' },
  { href: '/admin/accounting', label: '📚 Accounting' },
  { href: '/admin/pricing', label: '💰 Pricing' },
  { href: '/admin/merch', label: '🧪 Merch' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAuthed(true)
      } else if (pathname !== '/admin/login') {
        router.replace('/admin/login')
      }
      setChecking(false)
    })
  }, [pathname, router])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

  if (checking)
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#08081a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontFamily: 'Nunito, sans-serif',
        }}
      >
        Loading...
      </div>
    )

  if (pathname === '/admin/login') return <>{children}</>
  if (!authed) return null

  return (
    <div style={{ minHeight: '100vh', background: '#060d1a', fontFamily: 'Nunito, sans-serif' }}>
      <div
        style={{
          background: 'linear-gradient(135deg,#160a2e,#0d1535)',
          borderBottom: '1px solid rgba(255,165,0,0.2)',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto' as const,
        }}
      >
        <div
          style={{
            fontWeight: 900,
            color: '#ff7235',
            fontSize: 16,
            padding: '14px 16px 14px 0',
            whiteSpace: 'nowrap' as const,
            flexShrink: 0,
          }}
        >
          🔬 LS Admin
        </div>
        {NAV.map(n => (
          <a
            key={n.href}
            href={n.href}
            style={{
              padding: '14px',
              color: pathname === n.href ? '#ffd700' : 'rgba(255,255,255,0.4)',
              fontWeight: pathname === n.href ? 800 : 600,
              textDecoration: 'none',
              fontSize: 13,
              borderBottom: pathname === n.href ? '3px solid #ffd700' : '3px solid transparent',
              whiteSpace: 'nowrap' as const,
              flexShrink: 0,
            }}
          >
            {n.label}
          </a>
        ))}
        <button
          onClick={signOut}
          style={{
            marginLeft: 'auto',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.6)',
            padding: '6px 14px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: 'nowrap' as const,
            flexShrink: 0,
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          Sign out
        </button>
      </div>
      {children}
    </div>
  )
}
