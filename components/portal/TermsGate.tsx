'use client'

import { useState, type MouseEvent } from 'react'

const TERMS_URL = '/terms.pdf'
const TERMS_PAGE = '/terms'

export default function TermsGate({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  const [opened, setOpened] = useState(false)
  const [modal, setModal] = useState(false)

  function markOpened() {
    setOpened(true)
  }

  function openTerms(e?: MouseEvent) {
    e?.preventDefault()
    markOpened()
    setModal(true)
  }

  function openNewTab() {
    markOpened()
    window.open(TERMS_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="my-4 rounded-xl border border-white/15 bg-white/5 p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openTerms}
          className="rounded-lg bg-ls-yellow px-4 py-2.5 font-[family-name:var(--font-heading)] text-sm font-semibold text-[#07132D]"
        >
          Read Terms and Conditions
        </button>
        <button
          type="button"
          onClick={openNewTab}
          className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white/80"
        >
          Open PDF
        </button>
      </div>
      {!opened && (
        <p className="mb-3 text-sm font-medium text-amber-200/90">
          Open the Terms and Conditions before you can confirm.
        </p>
      )}
      <label
        className={`flex items-start gap-3 text-sm font-semibold leading-snug ${
          opened ? 'cursor-pointer text-white' : 'cursor-not-allowed text-white/40'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={!opened}
          onChange={e => onCheckedChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#FFC933]"
          aria-describedby="terms-gate-hint"
        />
        <span>I have read and understood the Terms and Conditions.</span>
      </label>
      <p id="terms-gate-hint" className="sr-only">
        Checkbox enables only after you open the terms document.
      </p>

      {modal && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Terms and Conditions"
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0E204F]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <h2 className="font-[family-name:var(--font-heading)] text-base font-bold text-white">
                Terms and Conditions
              </h2>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white/70 hover:bg-white/10"
                onClick={() => setModal(false)}
              >
                Close
              </button>
            </div>
            <iframe title="Terms and Conditions" src={TERMS_PAGE} className="min-h-[60vh] w-full flex-1 bg-white" />
            <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
              <a
                href={TERMS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white/80"
                onClick={markOpened}
              >
                Download PDF
              </a>
              <button
                type="button"
                className="rounded-lg bg-ls-yellow px-4 py-2 text-sm font-semibold text-[#07132D]"
                onClick={() => {
                  markOpened()
                  setModal(false)
                }}
              >
                I have read this
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
