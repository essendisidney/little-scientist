'use client'

import { useMemo, useState } from 'react'

type SessionType = 'exclusive' | 'non-exclusive'

export default function SchoolsPage() {
  const [schoolName, setSchoolName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [studentCount, setStudentCount] = useState<number>(30)
  const [preferredDate, setPreferredDate] = useState('')
  const [sessionType, setSessionType] = useState<SessionType>('non-exclusive')
  const [specialRequirements, setSpecialRequirements] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [enquiryRef, setEnquiryRef] = useState<string>('')

  const minDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })()

  const canSubmit = useMemo(() => {
    return (
      schoolName.trim() &&
      contactName.trim() &&
      contactPhone.trim() &&
      contactEmail.trim() &&
      Number.isFinite(studentCount) &&
      studentCount >= 10 &&
      preferredDate &&
      sessionType
    )
  }, [schoolName, contactName, contactPhone, contactEmail, studentCount, preferredDate, sessionType])

  async function submit() {
    setError('')
    if (!canSubmit) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/schools/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName,
          contactName,
          contactPhone,
          contactEmail,
          studentCount,
          preferredDate,
          sessionType,
          specialRequirements,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit enquiry')
      setEnquiryRef(String(data.enquiryRef || ''))
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
        *,*::before,*::after{box-sizing:border-box}
        html,body{margin:0;padding:0;background:#07041a}
        .page{
          min-height:100vh;
          font-family:'Nunito',sans-serif;
          color:#fff;
          background:
            radial-gradient(ellipse at 10% 0%, #2a0845 0%, transparent 50%),
            radial-gradient(ellipse at 90% 15%, #0a2d5c 0%, transparent 45%),
            #07041a;
        }
        .outer{max-width:860px;margin:0 auto;padding:32px 24px 80px;position:relative}
        .card{
          background:rgba(255,255,255,0.045);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:32px;
          padding:48px 52px;
          backdrop-filter:blur(12px);
          box-shadow:0 24px 90px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.04) inset;
          overflow:hidden;
        }
        .card::before{
          content:'';
          position:absolute;top:-1px;left:15%;right:15%;height:3px;
          background:linear-gradient(90deg,transparent,#FF6B9D,#FFD700,#7FFFD4,transparent);
        }
        .pill{
          display:inline-flex;align-items:center;gap:8px;
          background:rgba(255,215,0,0.1);
          border:1px solid rgba(255,215,0,0.22);
          color:#FFD700;
          font-size:11px;font-weight:800;
          padding:5px 14px;border-radius:20px;
          text-transform:uppercase;letter-spacing:0.1em;
          margin-bottom:18px;
        }
        h1{
          font-family:'Fredoka One',cursive;
          font-size:clamp(30px,4vw,44px);
          line-height:1.15;margin:0 0 10px;
        }
        h1 span{
          background:linear-gradient(90deg,#FF6B9D,#FFD700);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
        }
        .sub{color:rgba(255,255,255,0.55);font-size:14px;line-height:1.6;margin-bottom:28px}
        label{display:block;font-weight:800;font-size:12px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.08em;margin:14px 0 8px}
        .inp, .ta, .sel{
          width:100%;
          background:rgba(255,255,255,0.07);
          border:2px solid rgba(255,255,255,0.11);
          border-radius:18px;
          padding:18px 22px;
          color:#fff;
          font-size:16px;
          font-family:'Nunito',sans-serif;
          font-weight:700;
          transition:all .2s;
        }
        .ta{min-height:120px;resize:vertical}
        .inp:focus, .ta:focus, .sel:focus{
          outline:none;border-color:rgba(255,107,157,0.65);
          background:rgba(255,255,255,0.1);
          box-shadow:0 0 0 5px rgba(255,107,157,0.12);
        }
        .row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .cards{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .scard{
          background:rgba(255,255,255,0.04);
          border:2px solid rgba(255,255,255,0.10);
          border-radius:20px;
          padding:18px 18px;
          cursor:pointer;
          transition:all .2s cubic-bezier(0.34,1.56,0.64,1);
          text-align:left;
        }
        .scard:hover{transform:translateY(-4px);border-color:rgba(255,215,0,0.35);background:rgba(255,255,255,0.06)}
        .scard.on{border-color:rgba(255,215,0,0.55);box-shadow:0 10px 36px rgba(255,215,0,0.08)}
        .scard h3{margin:0 0 6px;font-family:'Fredoka One',cursive;font-size:18px}
        .scard p{margin:0;color:rgba(255,255,255,0.55);font-size:13px;line-height:1.6;font-weight:700}
        .cta{
          display:block;width:100%;
          background:linear-gradient(135deg,#FF4080,#FF8C00);
          color:#fff;border:none;border-radius:20px;
          padding:22px;font-family:'Fredoka One',cursive;font-size:22px;
          cursor:pointer;transition:all .25s cubic-bezier(0.34,1.56,0.64,1);
          box-shadow:0 8px 36px rgba(255,64,128,0.4);
        }
        .cta:hover{transform:translateY(-4px) scale(1.02);box-shadow:0 16px 52px rgba(255,64,128,0.55)}
        .cta:disabled{opacity:.6;cursor:not-allowed;transform:none}
        .err{
          color:#FF6B9D;font-size:15px;margin:16px 0 0;
          padding:14px 20px;background:rgba(255,107,157,0.08);
          border-radius:14px;border:1px solid rgba(255,107,157,0.22);
          font-weight:700;
        }
        .ok{
          text-align:center;padding:30px 0 6px;
        }
        .ok .big{font-size:92px;margin-bottom:16px}
        .ok h2{
          font-family:'Fredoka One',cursive;font-size:38px;margin:0 0 10px;
          background:linear-gradient(90deg,#7FFFD4,#00bfff);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
        }
        .ok p{color:rgba(255,255,255,0.55);font-size:15px;line-height:1.7;margin:0}
        .ref{
          margin:18px auto 0;
          max-width:420px;
          background:rgba(255,215,0,0.08);
          border:2px solid rgba(255,215,0,0.25);
          border-radius:18px;
          padding:14px 18px;
          text-align:left;
        }
        .ref .k{font-size:11px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;font-weight:800;margin-bottom:6px}
        .ref .v{font-family:'Fredoka One',cursive;font-size:26px;color:#FFD700;letter-spacing:0.12em}
        @media(max-width:640px){
          .card{padding:28px 20px}
          .outer{padding:24px 16px 60px}
          .row{grid-template-columns:1fr}
          .cards{grid-template-columns:1fr}
        }
      `}</style>

      <div className="page">
        <div className="outer">
          <div className="card" style={{ position: 'relative' }}>
            {!success ? (
              <>
                <div className="pill">🏫 School visits enquiry</div>
                <h1>
                  Plan a <span>school trip</span>
                </h1>
                <div className="sub">
                  Send us your preferred date and group size. We’ll confirm availability and share the best session option (exclusive or non-exclusive).
                </div>

                <label>School name *</label>
                <input className="inp" value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="e.g. Greenfield Academy" />

                <div className="row">
                  <div>
                    <label>Contact person *</label>
                    <input className="inp" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div>
                    <label>Contact phone *</label>
                    <input className="inp" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="e.g. 0700 101 425" type="tel" />
                  </div>
                </div>

                <label>Contact email *</label>
                <input className="inp" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="e.g. teacher@school.ac.ke" type="email" />

                <div className="row">
                  <div>
                    <label>Number of students *</label>
                    <input
                      className="inp"
                      value={String(studentCount)}
                      onChange={e => setStudentCount(Number(e.target.value))}
                      type="number"
                      min={10}
                    />
                  </div>
                  <div>
                    <label>Preferred date *</label>
                    <input className="inp" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} type="date" min={minDate} />
                  </div>
                </div>

                <label>Session type *</label>
                <div className="cards">
                  <button
                    type="button"
                    className={`scard ${sessionType === 'exclusive' ? 'on' : ''}`}
                    onClick={() => setSessionType('exclusive')}
                  >
                    <h3>⭐ Exclusive</h3>
                    <p>We have the park to ourselves.</p>
                  </button>
                  <button
                    type="button"
                    className={`scard ${sessionType === 'non-exclusive' ? 'on' : ''}`}
                    onClick={() => setSessionType('non-exclusive')}
                  >
                    <h3>🌈 Non-Exclusive</h3>
                    <p>Other groups may be present.</p>
                  </button>
                </div>

                <label>Any special requirements</label>
                <textarea
                  className="ta"
                  value={specialRequirements}
                  onChange={e => setSpecialRequirements(e.target.value)}
                  placeholder="Accessibility, special needs, learning goals, allergies, etc."
                />

                {error && <div className="err">{error}</div>}
                <div style={{ height: 18 }} />
                <button className="cta" onClick={submit} disabled={loading || !canSubmit}>
                  {loading ? 'Sending…' : 'Submit enquiry →'}
                </button>
              </>
            ) : (
              <div className="ok">
                <div className="big">✅</div>
                <h2>Enquiry sent!</h2>
                <p>
                  We’ve received your school visit enquiry.
                  <br />
                  Our team will get back to you shortly.
                </p>
                {enquiryRef && (
                  <div className="ref">
                    <div className="k">Reference</div>
                    <div className="v">{enquiryRef}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

