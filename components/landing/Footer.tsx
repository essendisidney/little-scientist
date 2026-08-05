import Link from 'next/link'

const links = [
  { href: '#experiences', label: 'Experiences' },
  { href: '/birthdays', label: 'Birthday' },
  { href: '/schools', label: 'School Trips' },
  { href: '#gallery', label: 'Gallery' },
  { href: '#contact', label: 'Contact' },
]

export default function Footer() {
  return (
    <footer className="border-t border-white/10 px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-[family-name:var(--font-heading)] text-lg font-extrabold text-white">Little Scientist</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-white/60">
          {links.map(l =>
            l.href.startsWith('/') ? (
              <Link key={l.href} href={l.href} className="hover:text-ls-yellow">
                {l.label}
              </Link>
            ) : (
              <a key={l.href} href={l.href} className="hover:text-ls-yellow">
                {l.label}
              </a>
            ),
          )}
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-5xl text-xs font-medium text-white/35">
        © {new Date().getFullYear()} Little Scientist. Not affiliated with any social media platforms or other
        websites.
      </p>
    </footer>
  )
}
