// Single source of truth for pricing logic.
// Prices are VAT-inclusive. VAT rate is 16% (Kenya standard rate).

export const VAT_RATE = 0.16

export type PriceTier = {
  key: string
  label: string
  sublabel: string
  priceInclVat: number // what the customer pays
  free: boolean
}

// Default pricing — can be replaced by DB lookup.
export const DEFAULT_TIERS: PriceTier[] = [
  {
    key: 'adult',
    label: 'Adults (18+)',
    sublabel: '18 years and above',
    priceInclVat: 1000,
    free: false,
  },
  {
    key: 'child',
    label: 'Children (95cm – 17 yrs)',
    sublabel: '95cm height to 17 years',
    priceInclVat: 800,
    free: false,
  },
  {
    key: 'infant',
    label: 'Under 95cm',
    sublabel: 'Height under 95cm — FREE entry',
    priceInclVat: 0,
    free: true,
  },
]

// VAT breakdown for a VAT-inclusive price
export function vatBreakdown(inclPrice: number) {
  const excl = inclPrice / (1 + VAT_RATE)
  const vat = inclPrice - excl
  const exclRounded = Math.round(excl * 100) / 100
  const vatRounded = Math.round(vat * 100) / 100
  return {
    excl: exclRounded,
    vat: vatRounded,
    incl: inclPrice,
    exclFormatted: exclRounded.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    vatFormatted: vatRounded.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    inclFormatted: inclPrice.toLocaleString('en-KE'),
  }
}

// Compute totals for a basket
export function computeBasket(adults: number, children: number, tiers: PriceTier[] = DEFAULT_TIERS) {
  const adultTier = tiers.find(t => t.key === 'adult')!
  const childTier = tiers.find(t => t.key === 'child')!

  const adultTotal = adults * adultTier.priceInclVat
  const childTotal = children * childTier.priceInclVat
  const grandTotal = adultTotal + childTotal

  const totalExcl = grandTotal / (1 + VAT_RATE)
  const totalVat = grandTotal - totalExcl

  const totalExclRounded = Math.round(totalExcl * 100) / 100
  const totalVatRounded = Math.round(totalVat * 100) / 100

  return {
    adults,
    adultPrice: adultTier.priceInclVat,
    adultTotal,
    children,
    childPrice: childTier.priceInclVat,
    childTotal,
    totalExcl: totalExclRounded,
    totalVat: totalVatRounded,
    grandTotal,
    totalExclFormatted: totalExclRounded.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    totalVatFormatted: totalVatRounded.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    grandTotalFormatted: grandTotal.toLocaleString('en-KE'),
  }
}

