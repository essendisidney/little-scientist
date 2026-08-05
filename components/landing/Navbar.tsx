'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const links = [
  { href: '#experiences', label: 'Experiences' },
  { href: '/birthdays', label: 'Birthday' },
  { href: '/schools', label: 'School Trips' },
  { href: '#gallery', label: 'Gallery' },
  { href: '#contact', label: 'Contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition ${
        scrolled ? 'border-b border-white/10 bg-[#07132D]/90 backdrop-blur-xl' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="font-[family-name:var(--font-heading)] text-base font-extrabold text-white sm:text-lg">
          Little Scientist
        </Link>
        <nav className="hidden items-center gap-5 md:flex" aria-label="Primary">
          {links.map(l =>
            l.href.startsWith('/') ? (
              <Link key={l.href} href={l.href} className="text-sm font-semibold text-white/70 hover:text-white">
                {l.label}
              </Link>
            ) : (
              <a key={l.href} href={l.href} className="text-sm font-semibold text-white/70 hover:text-white">
                {l.label}
              </a>
            ),
          )}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/book"
            className="rounded-lg bg-ls-yellow px-3 py-2 font-[family-name:var(--font-heading)] text-sm font-semibold text-[#07132D] sm:px-4"
          >
            Book Visit
          </Link>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/20 text-white md:hidden"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen(v => !v)}
          >
            {open ? '✕' : '☰'}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-white/10 bg-[#07132D]/95 px-4 py-3 md:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-2">
            {links.map(l =>
              l.href.startsWith('/') ? (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-lg px-2 py-2 text-sm font-semibold text-white/80"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.href}
                  href={l.href}
                  className="rounded-lg px-2 py-2 text-sm font-semibold text-white/80"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              ),
            )}
          </div>
        </nav>
      )}
    </header>
  )
}
