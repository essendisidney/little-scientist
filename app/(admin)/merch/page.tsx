'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'

type Variant = {
  id: string
  name: string | null
  price_kes: number
  stock_qty: number
  is_active: boolean
}

type Product = {
  id: string
  name: string
  description: string | null
  category: string
  is_active: boolean
  merch_variants: Variant[]
}

const fieldStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#fff',
  fontWeight: 700,
  fontFamily: 'Nunito, sans-serif',
  fontSize: 13,
}

export default function MerchPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [edits, setEdits] = useState<Record<string, { price: string; stock: string }>>({})

  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState('Science Kit')
  const [newPrice, setNewPrice] = useState('1500')
  const [newStock, setNewStock] = useState('10')
  const [saving, setSaving] = useState(false)

  const canCreate = useMemo(() => {
    return newName.trim() && newCategory.trim() && Number(newPrice) > 0 && Number(newStock) >= 0
  }, [newName, newCategory, newPrice, newStock])

  async function load() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/merch/products')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load products')
      setProducts(data.products || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    setEdits(prev => {
      const next = { ...prev }
      for (const p of products) {
        const v = p.merch_variants?.[0]
        if (!v) continue
        if (!next[v.id]) next[v.id] = { price: String(v.price_kes ?? 0), stock: String(v.stock_qty ?? 0) }
      }
      return next
    })
  }, [products])

  async function createProduct() {
    setError('')
    if (!canCreate) return
    setSaving(true)
    try {
      const res = await fetch('/api/merch/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          category: newCategory,
          priceKes: Number(newPrice),
          stockQty: Number(newStock),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create product')
      setNewName('')
      setNewDescription('')
      setNewPrice('1500')
      setNewStock('10')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create product')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(p: Product) {
    setError('')
    try {
      const res = await fetch(`/api/merch/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !p.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update product')
      setProducts(ps => ps.map(x => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update product')
    }
  }

  async function saveVariant(p: Product, v: Variant, nextPrice: number, nextStock: number) {
    setError('')
    try {
      const res = await fetch(`/api/merch/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: v.id, priceKes: nextPrice, stockQty: nextStock }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update variant')
      setProducts(ps =>
        ps.map(x =>
          x.id !== p.id
            ? x
            : {
                ...x,
                merch_variants: x.merch_variants.map(vx =>
                  vx.id === v.id ? { ...vx, price_kes: nextPrice, stock_qty: nextStock } : vx,
                ),
              },
        ),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update variant')
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap');
        .merch-page, .merch-page * { box-sizing: border-box; }
        .merch-add-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        @media (min-width: 900px) {
          .merch-add-grid {
            grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 0.7fr) auto;
            align-items: center;
          }
        }
        .merch-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .merch-table { width: 100%; min-width: 760px; border-collapse: collapse; table-layout: fixed; font-size: 13px; }
        .merch-table th, .merch-table td {
          padding: 10px 12px;
          text-align: left;
          vertical-align: middle;
          overflow: hidden;
        }
        .merch-table th {
          color: rgba(255,255,255,0.4);
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 800;
          letter-spacing: 0.06em;
          background: rgba(255,255,255,0.04);
        }
        .merch-table input[type='number'] {
          width: 100%;
          max-width: 110px;
          min-width: 0;
        }
      `}</style>
      <div className="merch-page" style={{ minHeight: '100vh', background: '#060d1a', color: '#e2e8f0', fontFamily: 'Nunito, sans-serif' }}>
        <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Merch Inventory</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                Manage science kits and on-site products.
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.7)',
                padding: '10px 12px',
                borderRadius: 10,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 800,
                fontFamily: 'Nunito, sans-serif',
                flexShrink: 0,
              }}
            >
              {loading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.22)',
                color: '#fca5a5',
                padding: '12px 14px',
                borderRadius: 12,
                fontWeight: 800,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 18,
              marginBottom: 18,
              overflow: 'hidden',
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 12 }}>Add new product</div>
            <div className="merch-add-grid">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" style={fieldStyle} />
              <input
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="Description"
                style={fieldStyle}
              />
              <input
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder="Category"
                style={fieldStyle}
              />
              <input
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
                placeholder="Price (KES)"
                type="number"
                style={fieldStyle}
              />
              <input
                value={newStock}
                onChange={e => setNewStock(e.target.value)}
                placeholder="Stock"
                type="number"
                style={fieldStyle}
              />
              <button
                onClick={createProduct}
                disabled={!canCreate || saving}
                style={{
                  background: 'linear-gradient(135deg,#ff5e1a,#ff8c42)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 16px',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: !canCreate || saving ? 'not-allowed' : 'pointer',
                  opacity: !canCreate || saving ? 0.6 : 1,
                  fontFamily: 'Nunito, sans-serif',
                  whiteSpace: 'nowrap',
                  width: '100%',
                }}
              >
                {saving ? 'Saving…' : '+ Add'}
              </button>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '14px 18px', fontWeight: 900 }}>Products</div>
            {products.length === 0 ? (
              <div style={{ padding: '14px 18px', color: 'rgba(255,255,255,0.35)' }}>No products yet.</div>
            ) : (
              <div className="merch-table-wrap">
                <table className="merch-table">
                  <colgroup>
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '20%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      {['Name', 'Category', 'Active', 'Price (KES)', 'Stock', 'Actions'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => {
                      const v = p.merch_variants?.[0]
                      const edit = v ? edits[v.id] : undefined
                      return (
                        <tr
                          key={p.id}
                          style={{
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                          }}
                        >
                          <td>
                            <div style={{ fontWeight: 900, overflowWrap: 'anywhere' }}>{p.name}</div>
                            {p.description ? (
                              <div style={{ color: 'rgba(255,255,255,0.4)', marginTop: 2, overflowWrap: 'anywhere' }}>
                                {p.description}
                              </div>
                            ) : null}
                          </td>
                          <td style={{ color: 'rgba(255,255,255,0.75)', overflowWrap: 'anywhere' }}>
                            {p.category?.trim() || '—'}
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 900,
                                background: p.is_active ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                                color: p.is_active ? '#4ade80' : '#f87171',
                              }}
                            >
                              {p.is_active ? 'active' : 'inactive'}
                            </span>
                          </td>
                          <td>
                            <input
                              value={edit?.price ?? (v ? String(v.price_kes) : '0')}
                              onChange={e =>
                                v &&
                                setEdits(m => ({
                                  ...m,
                                  [v.id]: { price: e.target.value, stock: m[v.id]?.stock ?? String(v.stock_qty ?? 0) },
                                }))
                              }
                              type="number"
                              style={fieldStyle}
                            />
                          </td>
                          <td>
                            <input
                              value={edit?.stock ?? (v ? String(v.stock_qty) : '0')}
                              onChange={e =>
                                v &&
                                setEdits(m => ({
                                  ...m,
                                  [v.id]: { price: m[v.id]?.price ?? String(v.price_kes ?? 0), stock: e.target.value },
                                }))
                              }
                              type="number"
                              style={fieldStyle}
                            />
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                onClick={() =>
                                  v &&
                                  saveVariant(
                                    p,
                                    v,
                                    Number((edits[v.id]?.price ?? String(v.price_kes ?? 0)).trim() || 0),
                                    Number((edits[v.id]?.stock ?? String(v.stock_qty ?? 0)).trim() || 0),
                                  )
                                }
                                disabled={!v}
                                style={{
                                  background: 'rgba(255,255,255,0.06)',
                                  border: '1px solid rgba(255,255,255,0.12)',
                                  color: '#ffd700',
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  cursor: v ? 'pointer' : 'not-allowed',
                                  fontWeight: 900,
                                  fontFamily: 'Nunito, sans-serif',
                                  fontSize: 12,
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => toggleActive(p)}
                                style={{
                                  background: p.is_active ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.12)',
                                  border: '1px solid rgba(255,255,255,0.12)',
                                  color: p.is_active ? '#f87171' : '#4ade80',
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  fontWeight: 900,
                                  fontFamily: 'Nunito, sans-serif',
                                  fontSize: 12,
                                }}
                              >
                                {p.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
