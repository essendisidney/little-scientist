'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type PriceTier = {
  id: string
  key: string
  label: string
  sublabel: string
  price_kes: number
  vat_rate: number
  free: boolean
  active: boolean
  updated_at: string
  updated_by: string | null
}

const VAT_RATE = 0.16

function vatBreakdown(inclPrice: number) {
  const excl = inclPrice / (1 + VAT_RATE)
  const vat = inclPrice - excl
  return {
    excl: (Math.round(excl * 100) / 100).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    vat: (Math.round(vat * 100) / 100).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    incl: inclPrice.toLocaleString('en-KE'),
  }
}

export default function PricingAdminPage() {
  const [tiers, setTiers] = useState<PriceTier[]>([])
  const [editing, setEditing] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.from('pricing_tiers').select('*').order('price_kes', { ascending: false })
    setTiers((data || []) as PriceTier[])
    setLoading(false)
  }

  async function save(tier: PriceTier) {
    const newPrice = editing[tier.id] ?? tier.price_kes
    setSaving(tier.id)
    await supabase
      .from('pricing_tiers')
      .update({
        price_kes: newPrice,
        updated_at: new Date().toISOString(),
        updated_by: 'admin',
      })
      .eq('id', tier.id)
    setSaving(null)
    setSaved(tier.id)
    setTimeout(() => setSaved(null), 2500)
    load()
  }

  const S: React.CSSProperties = {
    display: 'block',
    width: '100%',
    background: 'rgba(255,255,255,0.07)',
    border: '2px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: '12px 16px',
    color: '#fff',
    fontSize: 22,
    fontFamily: "'Fredoka One', cursive",
    textAlign: 'center',
  }

  if (loading)
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#060d1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          fontFamily: 'Nunito,sans-serif',
        }}
      >
        Loading pricing...
      </div>
    )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&family=Fredoka+One&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { outline: none; border-color: rgba(255,215,0,0.6) !important; box-shadow: 0 0 0 4px rgba(255,215,0,0.1); }
        input::-webkit-inner-spin-button { opacity: 1; }
      `}</style>
      <div style={{ minHeight: '100vh', background: '#060d1a', color: '#e2e8f0', fontFamily: 'Nunito,sans-serif', padding: 24 }}>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontFamily: "'Fredoka One',cursive",
              fontSize: 26,
              background: 'linear-gradient(90deg,#FF6B9D,#FFD700)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 6,
            }}
          >
            💰 Ticket Pricing
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
            Change prices here — updates live immediately. No code change needed.
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255,215,0,0.07)',
            border: '1px solid rgba(255,215,0,0.18)',
            borderRadius: 14,
            padding: '14px 18px',
            marginBottom: 24,
            fontSize: 13,
            color: 'rgba(255,215,0,0.85)',
            fontWeight: 700,
            lineHeight: 1.6,
          }}
        >
          ⚠️ All prices are VAT-inclusive at 16%. The system automatically calculates and shows the VAT breakdown on receipts and tickets.
          <br />
          The amount shown here is what the customer pays. Example: KES 800 = KES 689.66 entry fee + KES 110.34 VAT.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
          {tiers.map(tier => {
            const currentPrice = editing[tier.id] ?? tier.price_kes
            const vat = vatBreakdown(currentPrice)
            const isDirty = editing[tier.id] !== undefined && editing[tier.id] !== tier.price_kes
            const isSaving = saving === tier.id
            const isSaved = saved === tier.id

            return (
              <div
                key={tier.id}
                style={{
                  background: tier.free ? 'rgba(127,255,212,0.05)' : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${isDirty ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 20,
                  padding: '22px 24px',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: 20, marginBottom: 4 }}>
                      {tier.key === 'adult' ? '🧑' : tier.key === 'child' ? '👧' : '👶'} {tier.label}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{tier.sublabel}</div>
                  </div>
                  {tier.free && (
                    <div
                      style={{
                        background: 'rgba(127,255,212,0.12)',
                        border: '1px solid rgba(127,255,212,0.3)',
                        color: '#7FFFD4',
                        padding: '4px 14px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      FREE
                    </div>
                  )}
                </div>

                {!tier.free && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end', marginBottom: 14 }}>
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'rgba(255,255,255,0.4)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            fontWeight: 800,
                            marginBottom: 8,
                          }}
                        >
                          Price (VAT-inclusive, KES)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: "'Fredoka One',cursive", fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>KES</span>
                          <input
                            type="number"
                            value={editing[tier.id] ?? tier.price_kes}
                            onChange={e => setEditing(prev => ({ ...prev, [tier.id]: parseInt(e.target.value) || 0 }))}
                            style={{ ...S, width: 140, border: '2px solid rgba(255,255,255,0.12)' }}
                            min={0}
                            step={50}
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => save(tier)}
                        disabled={!isDirty || isSaving}
                        style={{
                          padding: '12px 22px',
                          background: isSaved
                            ? 'rgba(46,204,113,0.3)'
                            : isDirty
                              ? 'linear-gradient(135deg,#FF4080,#FF8C00)'
                              : 'rgba(255,255,255,0.06)',
                          border: isSaved ? '1px solid rgba(46,204,113,0.5)' : '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 12,
                          color: '#fff',
                          fontFamily: "'Fredoka One',cursive",
                          fontSize: 16,
                          cursor: isDirty ? 'pointer' : 'default',
                          opacity: !isDirty && !isSaved ? 0.4 : 1,
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isSaving ? '...' : isSaved ? '✓ Saved!' : 'Save price'}
                      </button>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.3)',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginBottom: 8,
                        }}
                      >
                        Receipt will show:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4 }}>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Entry fee (excl. VAT)</span>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>KES {vat.excl}</span>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>VAT @ 16%</span>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>KES {vat.vat}</span>
                        <span
                          style={{
                            fontSize: 14,
                            color: '#fff',
                            fontWeight: 900,
                            borderTop: '1px solid rgba(255,255,255,0.08)',
                            paddingTop: 6,
                            marginTop: 4,
                          }}
                        >
                          Total
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            color: '#FFD700',
                            fontWeight: 900,
                            borderTop: '1px solid rgba(255,255,255,0.08)',
                            paddingTop: 6,
                            marginTop: 4,
                            textAlign: 'right',
                          }}
                        >
                          KES {vat.incl}
                        </span>
                      </div>
                    </div>

                    {tier.updated_at && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 10, fontWeight: 700 }}>
                        Last updated: {new Date(tier.updated_at).toLocaleString('en-KE')}
                        {tier.updated_by ? ` by ${tier.updated_by}` : ''}
                      </div>
                    )}
                  </>
                )}

                {tier.free && (
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                    No charge — gate staff verify height on arrival. No ticket issued for this category.
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div
          style={{
            maxWidth: 600,
            marginTop: 24,
            padding: '14px 18px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14,
            fontSize: 12,
            color: 'rgba(255,255,255,0.3)',
            fontWeight: 700,
            lineHeight: 1.8,
          }}
        >
          📌 Price changes take effect immediately for all new bookings.
          <br />
          📌 Existing bookings are not affected — they were charged at the price at time of booking.
          <br />
          📌 To change the VAT rate, contact Sidnet (requires a code update for KRA compliance).
        </div>
      </div>
    </>
  )
}

