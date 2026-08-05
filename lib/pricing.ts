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
export const BIRTHDAY_PRICING = {
  adult18PlusKes: 1500,
  child95cmTo17Kes: 1500,
  childUnder95cmKes: 800,
} as const

export const BIRTHDAY_FOOD_NOTICE =
  'Food and drinks are not included and are the responsibility of the booking party. No alcohol or drugs are allowed.'

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

// Compute totals for a basket (optional paid infants e.g. birthday under-95cm)
export function computeBasket(
  adults: number,
  children: number,
  tiers: PriceTier[] = DEFAULT_TIERS,
  infants = 0,
) {
  const adultTier = tiers.find(t => t.key === 'adult')!
  const childTier = tiers.find(t => t.key === 'child')!
  const infantTier = tiers.find(t => t.key === 'infant')

  const adultTotal = adults * adultTier.priceInclVat
  const childTotal = children * childTier.priceInclVat
  const infantTotal = infants * (infantTier?.priceInclVat ?? 0)
  const grandTotal = adultTotal + childTotal + infantTotal

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
    infants,
    infantPrice: infantTier?.priceInclVat ?? 0,
    infantTotal,
    totalExcl: totalExclRounded,
    totalVat: totalVatRounded,
    grandTotal,
    totalExclFormatted: totalExclRounded.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    totalVatFormatted: totalVatRounded.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    grandTotalFormatted: grandTotal.toLocaleString('en-KE'),
  }
}

