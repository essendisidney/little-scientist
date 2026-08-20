export const metadata = {
  title: 'Terms and Conditions — Little Scientist',
}

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-white px-5 py-10 text-[#111] sm:px-8">
      <h1 className="mb-2 font-[family-name:var(--font-heading)] text-2xl font-extrabold">
        Little Scientist — Terms and Conditions
      </h1>
      <p className="mb-8 text-sm text-neutral-600">Please read before confirming a booking.</p>

      <ol className="list-decimal space-y-4 pl-5 text-sm leading-relaxed sm:text-base">
        <li>Bookings are confirmed only after successful payment or written confirmation from Little Scientist.</li>
        <li>Tickets sold are not refundable or transferable.</li>
        <li>Adults may enter only when accompanied by children. Minors may enter only when accompanied by adults.</li>
        <li>Alcohol and drugs are strictly prohibited on site.</li>
        <li>Outside food and drinks are not allowed for general visits. For birthday and school bookings, food and drinks are the responsibility of the booking party. There is no restaurant on site.</li>
        <li>Session times must be observed. Late arrival may reduce available play time without refund.</li>
        <li>Little Scientist may refuse entry or remove guests who breach safety or conduct rules.</li>
        <li>Prices and availability are as shown at the time of booking and may change for future dates.</li>
        <li>For birthday and school enquiries, confirmation is subject to availability and staff follow-up.</li>
        <li>
          Contact: Sabaki Estate, Athi River · 0700 101 425 · info@littlescientist.ke
        </li>
      </ol>

      <p className="mt-10 text-xs text-neutral-500">
        This page is also available as a PDF at /terms.pdf. Replace both with lawyer-approved copy when ready.
      </p>
    </main>
  )
}
