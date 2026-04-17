'use client'

import { useMemo, useState } from 'react'

type SessionPreference = 'exclusive' | 'non-exclusive'

export default function BirthdaysPage() {
  const [parentName, setParentName] = useState('')
  const [phone, setPhone] = useState('')
  const [childName, setChildName] = useState('')
  const [childAge, setChildAge] = useState<number>(7)
  const [guestCount, setGuestCount] = useState<number>(20)
  const [preferredDate, setPreferredDate] = useState('')
  const [sessionPreference, setSessionPreference] = useState<SessionPreference>('non-exclusive')
  const [specialRequirements, setSpecialRequirements] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const canSubmit = useMemo(() => {
    return (
      parentName.trim() &&
      phone.trim() &&
      childName.trim() &&
      Number.isFinite(childAge) &&
      childAge > 0 &&
      Number.isFinite(guestCount) &&
      guestCount > 0 &&
      preferredDate &&
      sessionPreference
    )
  }, [parentName, phone, childName, childAge, guestCount, preferredDate, sessionPreference])

  async function submit() {
    setError('')
    if (!canSubmit) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/birthdays/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName,
          phone,
          childName,
          childAge,
          guestCount,
          preferredDate,
          sessionPreference,
          specialRequirements,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit enquiry')
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
        .ok{text-align:center;padding:30px 0 6px}
        .ok .big{font-size:92px;margin-bottom:16px}
        .ok h2{
          font-family:'Fredoka One',cursive;font-size:38px;margin:0 0 10px;
          background:linear-gradient(90deg,#7FFFD4,#00bfff);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
        }
        .ok p{color:rgba(255,255,255,0.55);font-size:15px;line-height:1.7;margin:0}
        @media(max-width:640px){
          .card{padding:28px 20px}
          .outer{padding:24px 16px 60px}
          .row{grid-template-columns:1fr}
        }
      `}</style>

      <div className="page">
        <div className="outer">
          <div className="card" style={{ position: 'relative' }}>
            {!success ? (
              <>
                <div className="pill">🎂 Birthday party enquiry</div>
                <h1>
                  Celebrate with a <span>science party</span>
                </h1>
                <div className="sub">
                  Tell us your preferred date and guest count. We’ll confirm availability and recommend an exclusive or non-exclusive session.
                </div>

                <div className="row">
                  <div>
                    <label>Parent name *</label>
                    <input className="inp" value={parentName} onChange={e => setParentName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div>
                    <label>Phone number *</label>
                    <input className="inp" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 0700 101 425" />
                  </div>
                </div>

                <div className="row">
                  <div>
                    <label>Child name *</label>
                    <input className="inp" value={childName} onChange={e => setChildName(e.target.value)} placeholder="Child's name" />
                  </div>
                  <div>
                    <label>Child's age *</label>
                    <input className="inp" value={String(childAge)} onChange={e => setChildAge(Number(e.target.value))} type="number" min={1} />
                  </div>
                </div>

                <div className="row">
                  <div>
                    <label>Number of guests *</label>
                    <input className="inp" value={String(guestCount)} onChange={e => setGuestCount(Number(e.target.value))} type="number" min={1} />
                  </div>
                  <div>
                    <label>Preferred date *</label>
                    <input className="inp" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} type="date" />
                  </div>
                </div>

                <label>Session preference *</label>
                <select className="sel" value={sessionPreference} onChange={e => setSessionPreference(e.target.value as SessionPreference)}>
                  <option value="exclusive">Exclusive (private party)</option>
                  <option value="non-exclusive">Non-exclusive (shared session)</option>
                </select>

                <label>Any special requirements</label>
                <textarea
                  className="ta"
                  value={specialRequirements}
                  onChange={e => setSpecialRequirements(e.target.value)}
                  placeholder="Cake table, accessibility, allergies, theme requests, etc."
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
                  We’ve received your birthday party enquiry.
                  <br />
                  Our team will get back to you shortly.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

