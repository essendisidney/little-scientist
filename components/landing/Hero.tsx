import Link from 'next/link'
import Image from 'next/image'
import Disclaimers from '@/components/portal/Disclaimers'

export default function Hero() {
  return (
    <section className="relative px-4 pb-10 pt-28 sm:px-6 sm:pt-32">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10">
        <div className="relative min-h-[280px] sm:min-h-[340px]">
          <Image
            src="/hero-kids-science.png"
            alt="Little Scientist park"
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 1024px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07132D] via-[#07132D]/55 to-[#07132D]/25" />
          <div className="relative z-10 flex min-h-[280px] flex-col justify-end p-6 sm:min-h-[340px] sm:p-10">
            <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Little Scientist
            </h1>
            <p className="mt-2 text-lg font-semibold text-ls-yellow sm:text-xl">Big Science for Little People</p>
            <p className="mt-2 text-sm font-medium text-white/75 sm:text-base">Sabaki Estate, Athi River</p>
            <Link
              href="/book"
              className="mt-6 inline-flex w-fit rounded-xl bg-ls-yellow px-5 py-3 font-[family-name:var(--font-heading)] text-sm font-semibold text-[#07132D]"
            >
              Book a Visit
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-6 max-w-5xl">
        <Disclaimers />
      </div>
    </section>
  )
}
