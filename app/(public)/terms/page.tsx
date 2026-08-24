export const metadata = {
  title: 'Entry Agreements — Little Scientist',
}

const WAIVERS = [
  {
    title: 'General Visit Entry Agreement & Risk Release',
    href: '/waivers/general-visit.pdf',
  },
  {
    title: 'Birthday Visit Entry Agreement & Risk Release',
    href: '/waivers/birthday-visit.pdf',
  },
  {
    title: 'School Visit Entry Agreement & Risk Release',
    href: '/waivers/school-visit.pdf',
  },
] as const

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-white px-5 py-10 text-[#111] sm:px-8">
      <h1 className="mb-2 font-[family-name:var(--font-heading)] text-2xl font-extrabold">
        Little Scientist — Entry Agreements
      </h1>
      <p className="mb-8 text-sm text-neutral-600">
        Please read the agreement that matches your visit before booking or confirming.
      </p>

      <ul className="space-y-4">
        {WAIVERS.map(w => (
          <li key={w.href}>
            <a
              href={w.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm font-semibold text-[#111] underline-offset-2 hover:bg-neutral-100 hover:underline sm:text-base"
            >
              {w.title} (PDF)
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
