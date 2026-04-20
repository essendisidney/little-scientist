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

