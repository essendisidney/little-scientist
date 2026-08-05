const MAPS_URL = 'https://maps.app.goo.gl/dHAjUcwbJAhYNitF7?g_st=ac'

export default function Location() {
  return (
    <section id="contact" className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold text-white">Contact</h2>
        <ul className="mt-5 space-y-3 text-base font-medium text-white/80">
          <li>Sabaki Estate, Athi River</li>
          <li>
            <a href="tel:+254700101425" className="hover:text-ls-yellow">
              0700 101 425
            </a>
          </li>
          <li>
            <a href="mailto:info@littlescientist.ke" className="hover:text-ls-yellow">
              info@littlescientist.ke
            </a>
          </li>
        </ul>
        <a
          href={MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex rounded-xl bg-ls-blue px-4 py-3 text-sm font-semibold text-white"
        >
          Google Maps
        </a>
      </div>
    </section>
  )
}
