'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { staffFetch } from '@/lib/staff-fetch'

type Doc = {
  id?: string
  doc_key: string
  title: string
  public_url: string
  updated_at?: string
  updated_by?: string | null
}

const KEYS = [
  { key: 'general_waiver', label: 'General visit waiver' },
  { key: 'birthday_waiver', label: 'Birthday waiver' },
  { key: 'school_waiver', label: 'School visit waiver' },
]

export default function DocumentsAdminPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)

  async function load() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/documents')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load documents')
      setDocs(data.documents || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function upload(key: string, file: File | null, title: string) {
    if (!file) return
    setUploading(key)
    setError('')
    setMsg('')
    try {
      const form = new FormData()
      form.set('key', key)
      form.set('title', title)
      form.set('file', file)
      const res = await staffFetch('/api/documents', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setMsg(`Updated ${key}`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(null)
    }
  }

  const card: CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060d1a', color: '#fff', fontFamily: 'Nunito, sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Fredoka One', cursive", fontSize: 26, marginBottom: 8 }}>📄 Waiver PDFs</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 700, marginBottom: 20, fontSize: 13 }}>
          Replace the booking terms PDFs yourself. Guests always see the latest uploaded file.
        </p>

        {error && (
          <div style={{ ...card, borderColor: 'rgba(248,113,113,0.4)', color: '#fca5a5', fontWeight: 800 }}>{error}</div>
        )}
        {msg && (
          <div style={{ ...card, borderColor: 'rgba(74,222,128,0.35)', color: '#86efac', fontWeight: 800 }}>{msg}</div>
        )}

        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</div>
        ) : (
          KEYS.map(({ key, label }) => {
            const doc = docs.find((d) => d.doc_key === key)
            return (
              <div key={key} style={card}>
                <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 12, fontWeight: 700 }}>
                  {doc?.title || key}
                  {doc?.updated_at ? ` · updated ${new Date(doc.updated_at).toLocaleString('en-KE')}` : ''}
                </div>
                {doc?.public_url && (
                  <a
                    href={doc.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#FFD700', fontWeight: 800, fontSize: 13, display: 'inline-block', marginBottom: 12 }}
                  >
                    Open current PDF →
                  </a>
                )}
                <div>
                  <input
                    type="file"
                    accept="application/pdf"
                    disabled={uploading === key}
                    onChange={(e) => upload(key, e.target.files?.[0] || null, doc?.title || label)}
                  />
                  {uploading === key && <span style={{ marginLeft: 10, color: '#FFD700', fontWeight: 800 }}>Uploading…</span>}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
