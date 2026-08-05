const tiers = [
  { name: 'Little Explorers', who: 'Under 94.9 cm', price: 'FREE' },
  { name: 'Young Scientists', who: '95 cm – 17 yrs', price: 'KES 800', highlight: true },
  { name: 'Adults', who: '18+', price: 'KES 1,000' },
]

export default function Pricing() {
  return (
    <section id="pricing" className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-6 font-[family-name:var(--font-heading)] text-2xl font-extrabold text-white">
          Admission Prices
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {tiers.map(t => (
            <article
              key={t.name}
              className={`rounded-2xl border p-5 ${
                t.highlight
                  ? 'border-ls-yellow/60 bg-ls-yellow/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-white">{t.name}</h3>
              <p className="mt-1 text-sm font-medium text-white/55">{t.who}</p>
              <p className="mt-4 text-2xl font-bold text-ls-yellow">{t.price}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
