import Link from 'next/link'

const items = [
  {
    title: 'Birthday',
    desc: 'Shared or exclusive party booking.',
    href: '/birthdays',
  },
  {
    title: 'School Trips',
    desc: 'Group visits — minimum 20 students.',
    href: '/schools',
  },
  {
    title: 'General Visit',
    desc: 'Book a session and pay online.',
    href: '/book',
  },
]

export default function Experiences() {
  return (
    <section id="experiences" className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-6 font-[family-name:var(--font-heading)] text-2xl font-extrabold text-white">
          Experiences
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {items.map(item => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-ls-cyan/40"
            >
              <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-sm font-medium text-white/60">{item.desc}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-ls-yellow">Continue →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
