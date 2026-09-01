import { isKcbConfigured } from '@/lib/kcb/config'

/** True when online / counter STK should use KCB BUNI (same as ticket checkout). */
export function useKcbPayments(): boolean {
  const provider = (process.env.PAYMENT_PROVIDER || (isKcbConfigured() ? 'kcb' : 'daraja')).toLowerCase()
  return provider === 'kcb' || (provider === 'auto' && isKcbConfigured())
}

export function paymentProviderName(): 'kcb' | 'daraja' {
  return useKcbPayments() ? 'kcb' : 'daraja'
}
