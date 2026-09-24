import { unstable_noStore as noStore } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import { BIRTHDAY_PRICING } from '@/lib/pricing'

export type KesPrices = {
  adult18PlusKes: number
  child95cmTo17Kes: number
  childUnder95cmKes: number
}

export type PublicPrices = {
  general: KesPrices
  birthday: KesPrices
}

const GENERAL_FALLBACK: KesPrices = {
  adult18PlusKes: 1000,
  child95cmTo17Kes: 800,
  childUnder95cmKes: 300,
}

const BIRTHDAY_FALLBACK: KesPrices = {
  adult18PlusKes: BIRTHDAY_PRICING.adult18PlusKes,
  child95cmTo17Kes: BIRTHDAY_PRICING.child95cmTo17Kes,
  childUnder95cmKes: BIRTHDAY_PRICING.childUnder95cmKes,
}

function kes(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export async function loadPublicPrices(): Promise<PublicPrices> {
  noStore()
  try {
    const { data } = await supabaseAdmin
      .from('pricing_tiers')
      .select('key, price_kes')
      .eq('active', true)
    const rows = (data || []) as { key: string; price_kes: number }[]
    const price = (key: string) => rows.find(row => row.key === key)?.price_kes
    const adult = price('adult')
    const child = price('child')
    const infant = price('infant')
    return {
      general: {
        adult18PlusKes: kes(adult, GENERAL_FALLBACK.adult18PlusKes),
        child95cmTo17Kes: kes(child, GENERAL_FALLBACK.child95cmTo17Kes),
        childUnder95cmKes: kes(infant, GENERAL_FALLBACK.childUnder95cmKes),
      },
      birthday: {
        adult18PlusKes: kes(price('birthday_adult') ?? adult, BIRTHDAY_FALLBACK.adult18PlusKes),
        child95cmTo17Kes: kes(price('birthday_child') ?? child, BIRTHDAY_FALLBACK.child95cmTo17Kes),
        childUnder95cmKes: kes(price('birthday_infant') ?? infant, BIRTHDAY_FALLBACK.childUnder95cmKes),
      },
    }
  } catch {
    return { general: GENERAL_FALLBACK, birthday: BIRTHDAY_FALLBACK }
  }
}

export function formatAdmissionPrice(kesAmount: number) {
  if (kesAmount <= 0) return 'FREE'
  return `KES ${kesAmount.toLocaleString('en-KE')}`
}
