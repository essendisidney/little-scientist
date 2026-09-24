'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type DisplayTier = {
  name: string
  who: string
  price: string
  highlight?: boolean
}

const FALLBACK: DisplayTier[] = [
  { name: 'Little Explorers', who: 'Under 94.9 cm', price: 'FREE' },
  { name: 'Young Scientists', who: '95 cm – 17 yrs', price: 'KES 800', highlight: true },
  { name: 'Adults', who: '18+', price: 'KES 1,000' },
]

function formatPrice(kes: number, free: boolean) {
  if (free || kes <= 0) return 'FREE'
  return `KES ${kes.toLocaleString('en-KE')}`
}

export default function Pricing() {
  const [tiers, setTiers] = useState<DisplayTier[]>(FALLBACK)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data } = await supabase
          .from('pricing_tiers')
          .select('key, price_kes, free, active')
          .eq('active', true)
        if (!alive || !data?.length) return
        const byKey = (k: string) => data.find(t => t.key === k)
        const infant = byKey('infant')
        const child = byKey('child')
        const adult = byKey('adult')
        setTiers([
          {
            name: 'Little Explorers',
            who: 'Under 94.9 cm',
            price: formatPrice(Number(infant?.price_kes ?? 0), Boolean(infant?.free ?? true)),
          },
          {
            name: 'Young Scientists',
            who: '95 cm – 17 yrs',
            price: formatPrice(Number(child?.price_kes ?? 800), Boolean(child?.free)),
            highlight: true,
          },
          {
            name: 'Adults',
            who: '18+',
            price: formatPrice(Number(adult?.price_kes ?? 1000), Boolean(adult?.free)),
          },
        ])
      } catch {
        /* keep fallbacks */
      }
    })()
    return () => {
      alive = false
    }
  }, [])

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
