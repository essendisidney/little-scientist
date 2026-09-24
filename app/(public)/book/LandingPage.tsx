import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import Pricing from '@/components/landing/Pricing'
import Experiences from '@/components/landing/Experiences'
import Gallery from '@/components/landing/Gallery'
import Location from '@/components/landing/Location'
import Footer from '@/components/landing/Footer'
import WatermarkBg from '@/components/portal/WatermarkBg'
import { formatAdmissionPrice, loadPublicPrices } from '@/lib/public-prices'

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const prices = await loadPublicPrices()
  const admission = [
    { name: 'Little Explorers', who: 'Under 94.9 cm', price: formatAdmissionPrice(prices.general.childUnder95cmKes) },
    {
      name: 'Young Scientists',
      who: '95 cm – 17 yrs',
      price: formatAdmissionPrice(prices.general.child95cmTo17Kes),
      highlight: true,
    },
    { name: 'Adults', who: '18+', price: formatAdmissionPrice(prices.general.adult18PlusKes) },
  ]

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ls-bg text-white">
      <WatermarkBg />
      <div className="relative z-10">
        <Navbar />
        <main>
          <Hero />
          <Pricing initial={admission} />
          <Experiences />
          <Gallery />
          <Location />
        </main>
        <Footer />
      </div>
    </div>
  )
}
