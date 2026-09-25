'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { staffFetch } from '@/lib/staff-fetch'

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

const TIER_ORDER = ['adult', 'child', 'infant', 'birthday_adult', 'birthday_child', 'birthday_infant']

function tierEmoji(key: string) {
  if (key === 'adult' || key.endsWith('_adult')) return '🧑'
  if (key === 'child' || key.endsWith('_child')) return '👧'
  return '👶'
}

function tierGroup(key: string) {
  return key.startsWith('birthday') ? 'Birthday' : 'General visit'
}

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
  const [error, setError] = useState('')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setError('')
    setLoading(true)
    try {
      const res = await staffFetch('/api/admin/pricing')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load pricing.')
      setTiers((data.tiers || []) as PriceTier[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pricing.')
      setTiers([])
    } finally {
      setLoading(false)
    }
  }

  async function save(tier: PriceTier) {
    const newPrice = editing[tier.id] ?? tier.price_kes
    setSaving(tier.id)
    setError('')
    try {
      const res = await staffFetch('/api/admin/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tier.id,
          priceKes: newPrice,
          free: newPrice === 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save price.')
      setSaved(tier.id)
      setTimeout(() => setSaved(null), 2500)
      setEditing((prev) => {
        const next = { ...prev }
        delete next[tier.id]
        return next
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save price.')
    } finally {
      setSaving(null)
    }
  }

  const inputStyle: React.CSSProperties = useMemo(
    () => ({
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
    }),
    [],
  )

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#060d1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontFamily: 'Nunito,sans-serif',
        }}
      >
        Loading pricing...
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&family=Fredoka+One&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { outline: none; border-color: rgba(255,215,0,0.6) !important; box-shadow: 0 0 0 4px rgba(255,215,0,0.1); }
        input::-webkit-inner-spin-button { opacity: 1; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#060d1a', color: '#e2e8f0', fontFamily: 'Nunito,sans-serif', padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
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
            General visit prices are separate from birthday prices. Set general under-95cm to 0 for free entry. Birthday under-95cm is its own price.
          </div>
        </div>

        {error && (
          <div
            style={{
              maxWidth: 600,
              marginBottom: 16,
              background: 'rgba(255,80,80,0.08)',
              border: '1px solid rgba(255,80,80,0.25)',
              borderRadius: 14,
              padding: '12px 14px',
              color: 'rgba(255,180,180,0.9)',
              fontWeight: 800,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            maxWidth: 600,
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
          ⚠️ All prices are VAT-inclusive at 16%. The amount shown here is what the customer pays.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
          {tiers.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
              No pricing rows yet. Apply migration 016 (`pricing_tiers`) then refresh.
            </div>
          ) : (
            [...tiers]
              .sort((a, b) => {
                const ia = TIER_ORDER.indexOf(a.key)
                const ib = TIER_ORDER.indexOf(b.key)
                return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
              })
              .map((tier) => {
              const currentPrice = editing[tier.id] ?? tier.price_kes
              const vat = vatBreakdown(currentPrice)
              const isDirty = editing[tier.id] !== undefined && editing[tier.id] !== tier.price_kes
              const isSaving = saving === tier.id
              const isSaved = saved === tier.id
              const emoji = tierEmoji(tier.key)

              return (
                <div
                  key={tier.id}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `2px solid ${isDirty ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 20,
                    padding: '22px 24px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#FFD700', fontWeight: 800, letterSpacing: '0.04em', marginBottom: 4 }}>
                        {tierGroup(tier.key)}
                      </div>
                      <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: 20, marginBottom: 4 }}>
                        {emoji} {tier.label}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{tier.sublabel}</div>
                    </div>
                    {currentPrice === 0 && (
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
                          onChange={(e) => setEditing((prev) => ({ ...prev, [tier.id]: parseInt(e.target.value) || 0 }))}
                          style={{ ...inputStyle, width: 140, border: '2px solid rgba(255,255,255,0.12)' }}
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
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isSaving ? '...' : isSaved ? '✓ Saved!' : 'Save price'}
                    </button>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4 }}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Entry fee (excl. VAT)</span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>KES {vat.excl}</span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>VAT @ 16%</span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>KES {vat.vat}</span>
                      <span style={{ fontSize: 14, color: '#fff', fontWeight: 900, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, marginTop: 4 }}>
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
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
