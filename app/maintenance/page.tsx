'use client'

import { useEffect, useState } from 'react'

export default function MaintenancePage() {
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    const iv = setInterval(() => setPulse(p => (p + 1) % 1000000), 1800)
    return () => clearInterval(iv)
  }, [])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&family=Fredoka+One&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #07041a; }
        .page{
          min-height:100vh;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:24px;
          color:#fff;
          font-family:'Nunito',sans-serif;
          background:
            radial-gradient(ellipse at 10% 0%, #2a0845 0%, transparent 50%),
            radial-gradient(ellipse at 90% 15%, #0a2d5c 0%, transparent 45%),
            #07041a;
        }
        .card{
          width:100%;
          max-width:720px;
          background:rgba(255,255,255,0.045);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:32px;
          padding:48px 52px;
          box-shadow:0 24px 90px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset;
          position:relative;
          overflow:hidden;
          text-align:center;
        }
        .card::before{
          content:'';
          position:absolute;
          top:-1px; left:15%; right:15%; height:3px;
          background:linear-gradient(90deg,transparent,#FF6B9D,#FFD700,#7FFFD4,transparent);
        }
        .emoji{
          font-size:92px;
          margin-bottom:14px;
          animation:bounce 1.6s ease-in-out infinite;
          filter: drop-shadow(0 12px 28px rgba(255,215,0,0.12));
        }
        @keyframes bounce{
          0%,100%{transform:translateY(0) scale(1)}
          50%{transform:translateY(-18px) scale(1.06)}
        }
        h1{
          font-family:'Fredoka One',cursive;
          font-size:clamp(34px,4vw,52px);
          line-height:1.1;
          margin-bottom:10px;
        }
        h1 span{
          background:linear-gradient(90deg,#FF6B9D,#FFD700);
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
        }
        .sub{
          color:rgba(255,255,255,0.55);
          font-size:15px;
          line-height:1.7;
          margin:0 auto 22px;
          max-width:520px;
          font-weight:700;
        }
        .phone{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:10px;
          background:rgba(255,215,0,0.10);
          border:1px solid rgba(255,215,0,0.22);
          color:#FFD700;
          padding:12px 18px;
          border-radius:18px;
          font-weight:900;
          font-size:16px;
        }
        @media(max-width:640px){
          .card{padding:28px 20px}
        }
      `}</style>

      <div className="page" aria-live="polite">
        <div className="card">
          <div className="emoji" key={pulse}>
            🔬
          </div>
          <h1>
            We are <span>getting ready!</span>
          </h1>
          <p className="sub">
            Little Scientist is launching soon. We’re doing a quick setup so your booking experience is smooth and secure.
          </p>
          <div className="phone">📞 Enquiries: 0700 101 425</div>
        </div>
      </div>
    </>
  )
}

/* DUPLICATE BLOCK (commented out)
'use client'

export default function MaintenancePage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;background:#07041a}
        .page{
          min-height:100vh;
          font-family:'Nunito',sans-serif;
          color:#fff;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:24px;
          background:
            radial-gradient(ellipse at 10% 0%, #2a0845 0%, transparent 50%),
            radial-gradient(ellipse at 90% 15%, #0a2d5c 0%, transparent 45%),
            #07041a;
        }
        .card{
          width:100%;
          max-width:720px;
          background:rgba(255,255,255,0.045);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:32px;
          padding:48px 42px;
          backdrop-filter:blur(12px);
          box-shadow:0 24px 90px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.04) inset;
          text-align:center;
          position:relative;
          overflow:hidden;
        }
        .card::before{
          content:'';
          position:absolute;
          top:-1px;left:15%;right:15%;height:3px;
          background:linear-gradient(90deg,transparent,#FF6B9D,#FFD700,#7FFFD4,transparent);
        }
        .emoji{
          font-size:96px;
          margin-bottom:18px;
          animation:bounce 1.8s ease-in-out infinite;
          filter:drop-shadow(0 12px 32px rgba(255,215,0,0.18));
        }
        @keyframes bounce{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-18px) scale(1.06)}}
        h1{
          font-family:'Fredoka One',cursive;
          font-size:clamp(34px,4.5vw,52px);
          line-height:1.1;
          margin-bottom:10px;
        }
        h1 span{
          background:linear-gradient(90deg,#FF6B9D,#FFD700);
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
        }
        .sub{
          font-size:15px;
          color:rgba(255,255,255,0.55);
          line-height:1.8;
          font-weight:700;
          margin-bottom:20px;
        }
        .pill{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:8px 14px;
          border-radius:999px;
          background:rgba(255,215,0,0.1);
          border:1px solid rgba(255,215,0,0.22);
          color:#FFD700;
          font-weight:900;
          font-size:12px;
          letter-spacing:0.08em;
          text-transform:uppercase;
        }
        @media(max-width:640px){.card{padding:34px 20px}}
      `}</style>
      <div className="page">
        <div className="card">
          <div className="emoji">🔬</div>
          <h1>
            We are <span>getting ready!</span>
          </h1>
          <div className="sub">
            Little Scientist is launching soon.
            <br />
            For enquiries call <strong style={{ color: '#FFD700' }}>0700 101 425</strong>
          </div>
          <div className="pill">✨ Thanks for your patience</div>
        </div>
      </div>
    </>
  )
}

*/

