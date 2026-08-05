import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import Pricing from '@/components/landing/Pricing'
import Experiences from '@/components/landing/Experiences'
import Gallery from '@/components/landing/Gallery'
import Location from '@/components/landing/Location'
import Footer from '@/components/landing/Footer'
import WatermarkBg from '@/components/portal/WatermarkBg'

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ls-bg text-white">
      <WatermarkBg />
      <div className="relative z-10">
        <Navbar />
        <main>
          <Hero />
          <Pricing />
          <Experiences />
          <Gallery />
          <Location />
        </main>
        <Footer />
      </div>
    </div>
  )
}
