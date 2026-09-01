'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Role = 'admin' | 'gate' | 'counter' | 'accounting'

const NAV = [
  { href: '/admin/dashboard', label: 'Bookings' },
  { href: '/admin/accounting', label: 'Payments' },
  { href: '/admin/verify', label: 'Gate Verify' },
  { href: '/admin/invenue', label: 'In-Venue' },
  { href: '/admin/pricing', label: 'Pricing' },
  { href: '/admin/merch', label: 'Merch' },
] as const

const ROLE_ALLOW: Record<Role, string[]> = {
  admin: ['/admin'], // all admin routes
  gate: ['/admin/verify'],
  counter: ['/admin/invenue', '/admin/merch'],
  accounting: ['/admin/accounting', '/admin/dashboard'],
}

function getRoleFromSession(session: any): Role {
  const raw =
    session?.user?.app_metadata?.role ??
    session?.user?.user_metadata?.role ??
    session?.user?.app_metadata?.roles?.[0] ??
    session?.user?.user_metadata?.roles?.[0] ??
    null
  const v = typeof raw === 'string' ? raw.toLowerCase() : ''
  if (v === 'gate' || v === 'counter' || v === 'accounting' || v === 'admin') return v
  // Backwards-compatible default to avoid locking existing users out.
  return 'admin'
}

function isAllowed(role: Role, pathname: string) {
  const allow = ROLE_ALLOW[role]
  return allow.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/') || prefix === '/admin')
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [role, setRole] = useState<Role>('admin')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAuthed(true)
        setUserEmail(data.session.user.email || '')
        const r = getRoleFromSession(data.session)
        setRole(r)
        if (pathname !== '/admin/login' && !isAllowed(r, pathname)) {
          const firstAllowed =
            NAV.find(n => isAllowed(r, n.href))?.href ||
            (r === 'gate' ? '/admin/verify' : r === 'counter' ? '/admin/invenue' : r === 'accounting' ? '/admin/accounting' : '/admin/dashboard')
          router.replace(firstAllowed)
        }
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

  const visibleNav = NAV.filter(n => isAllowed(role, n.href))

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
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.45)',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginRight: 10,
            whiteSpace: 'nowrap' as const,
            flexShrink: 0,
          }}
          title="Access level"
        >
          {role}
        </div>
        {userEmail && (
          <div
            style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: 12,
              fontWeight: 600,
              marginRight: 12,
              whiteSpace: 'nowrap' as const,
              flexShrink: 0,
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={userEmail}
          >
            {userEmail}
          </div>
        )}
        {visibleNav.map(n => (
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
