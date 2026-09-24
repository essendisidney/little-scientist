import BookPage from './BookClient'
import { loadPublicPrices } from '@/lib/public-prices'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const prices = await loadPublicPrices()
  return <BookPage initialPricing={prices.general} initialBirthdayPricing={prices.birthday} />
}
