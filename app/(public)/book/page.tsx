'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const ADULT_PRICE = 500
const CHILD_PRICE = 300
const SLOT_LABELS: Record<string, string> = {
  '10:00-12:00': '10:00 AM – 12:00 PM',
  '12:00-14:00': '12:00 PM – 2:00 PM',
  '14:00-16:00': '2:00 PM – 4:00 PM',
}
type Session = {
  id: string
  session_date: string
  time_slot: string
  capacity: number
  booked_count: number
  is_blocked: boolean
}
type Step = 'date' | 'slot' | 'count' | 'payment' | 'pending' | 'success'

const MIN_DAYS = 1
const MAX_DAYS = 30

// ── ILLUSTRATED KIDS ─────────────────────────────────────────

// Large colourful pencil-effect science illustrations
// Derived from `science-illustrations.tsx`
const KidWithMicroscope = () => (
  <svg
    viewBox="0 0 200 280"
    fill="none"
    style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 0 20px rgba(168,100,255,0.4))' }}
  >
    <defs>
      <filter id="pencil1">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" result="displaced" />
        <feComposite in="displaced" in2="SourceGraphic" operator="over" />
      </filter>
    </defs>
    {/* glow rings behind */}
    <circle
      cx="100"
      cy="140"
      r="85"
      fill="rgba(168,100,255,0.06)"
      stroke="rgba(168,100,255,0.15)"
      strokeWidth="1"
    />
    <circle
      cx="100"
      cy="140"
      r="70"
      fill="rgba(255,107,157,0.04)"
      stroke="rgba(255,107,157,0.1)"
      strokeWidth="0.5"
    />

    {/* BODY */}
    <ellipse
      cx="100"
      cy="205"
      rx="38"
      ry="48"
      fill="#FF6B9D"
      stroke="#d94f82"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    {/* lab coat */}
    <path
      d="M62 190 Q62 245 100 250 Q138 245 138 190 Q122 198 100 198 Q78 198 62 190Z"
      fill="#fff"
      stroke="#c8c8d8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="none"
    />
    {/* coat seam */}
    <path d="M96 198 L96 250 M104 198 L104 250" stroke="#ddd" strokeWidth="1.5" opacity="0.7" />
    {/* pocket */}
    <rect x="68" y="220" width="16" height="12" rx="3" stroke="#bbb" strokeWidth="1.5" fill="none" />
    <path d="M72 215 L74 220" stroke="#FF6B9D" strokeWidth="2" strokeLinecap="round" />
    <path d="M75 214 L76 220" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />

    {/* HEAD */}
    <circle cx="100" cy="118" r="38" fill="#FDBCB4" stroke="#e8a090" strokeWidth="2.5" />
    {/* HAIR */}
    <path d="M62 108 Q66 78 100 74 Q134 78 138 108 Q130 88 100 85 Q70 88 62 108Z" fill="#3d1f00" stroke="#2d1500" strokeWidth="1.5" />
    <path d="M62 108 Q57 118 60 130" stroke="#3d1f00" strokeWidth="7" strokeLinecap="round" />
    <path d="M138 108 Q143 118 140 130" stroke="#3d1f00" strokeWidth="7" strokeLinecap="round" />

    {/* GLASSES frames */}
    <circle cx="88" cy="118" r="11" stroke="#7c5cbf" strokeWidth="2.5" fill="rgba(124,92,191,0.08)" />
    <circle cx="112" cy="118" r="11" stroke="#7c5cbf" strokeWidth="2.5" fill="rgba(124,92,191,0.08)" />
    <path d="M99 118 L101 118" stroke="#7c5cbf" strokeWidth="2" />
    <path d="M77 115 Q74 112 71 114" stroke="#7c5cbf" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M123 115 Q126 112 129 114" stroke="#7c5cbf" strokeWidth="2" strokeLinecap="round" fill="none" />
    {/* eyes behind glasses */}
    <circle cx="88" cy="118" r="5" fill="#fff" />
    <circle cx="112" cy="118" r="5" fill="#fff" />
    <circle cx="89" cy="118" r="3" fill="#2d1b00" />
    <circle cx="113" cy="118" r="3" fill="#2d1b00" />
    <circle cx="90" cy="116" r="1" fill="#fff" />
    <circle cx="114" cy="116" r="1" fill="#fff" />
    {/* smile */}
    <path d="M88 132 Q100 142 112 132" stroke="#e07060" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* cheeks */}
    <circle cx="76" cy="126" r="7" fill="#FFB3A3" opacity="0.5" />
    <circle cx="124" cy="126" r="7" fill="#FFB3A3" opacity="0.5" />

    {/* ARMS */}
    <path d="M62 195 Q44 200 36 218" stroke="#FDBCB4" strokeWidth="13" strokeLinecap="round" />
    <path d="M138 195 Q158 196 166 210" stroke="#FDBCB4" strokeWidth="13" strokeLinecap="round" />
    {/* hands */}
    <circle cx="34" cy="222" r="10" fill="#FDBCB4" stroke="#e8a090" strokeWidth="1.5" />
    <circle cx="168" cy="213" r="10" fill="#FDBCB4" stroke="#e8a090" strokeWidth="1.5" />

    {/* BIG COLOURFUL MICROSCOPE */}
    {/* base */}
    <rect x="140" y="235" width="50" height="8" rx="4" fill="#9b59b6" stroke="#7d3c98" strokeWidth="1.5" />
    {/* arm */}
    <rect x="158" y="175" width="14" height="64" rx="4" fill="#8e44ad" stroke="#6c3483" strokeWidth="1.5" />
    {/* stage */}
    <rect x="148" y="220" width="34" height="8" rx="3" fill="#a569bd" stroke="#7d3c98" strokeWidth="1.5" />
    {/* slide on stage */}
    <rect x="154" y="212" width="22" height="6" rx="2" fill="#d5f5e3" stroke="#27ae60" strokeWidth="1" />
    {/* body tube */}
    <rect x="153" y="155" width="24" height="24" rx="5" fill="#bb8fce" stroke="#8e44ad" strokeWidth="1.5" />
    {/* eyepiece */}
    <rect x="158" y="142" width="14" height="16" rx="4" fill="#6c3483" stroke="#4a235a" strokeWidth="1.5" />
    <circle cx="165" cy="140" r="8" fill="#2980b9" stroke="#1a5276" strokeWidth="2" />
    <circle cx="165" cy="140" r="5" fill="#85c1e9" />
    <circle cx="163" cy="138" r="2" fill="#fff" opacity="0.6" />
    {/* objective lens */}
    <circle cx="165" cy="218" r="7" fill="#1a5276" stroke="#154360" strokeWidth="2" />
    <circle cx="165" cy="218" r="4" fill="#2e86c1" />
    {/* arm connector */}
    <path d="M160 200 Q145 205 148 220" stroke="#7d3c98" strokeWidth="4" strokeLinecap="round" fill="none" />
    {/* glow on lens */}
    <circle cx="165" cy="218" r="10" fill="none" stroke="rgba(41,128,185,0.4)" strokeWidth="3" />

    {/* SPECIMEN GLOWING */}
    <ellipse cx="165" cy="215" rx="8" ry="3" fill="rgba(46,204,113,0.3)" stroke="#27ae60" strokeWidth="1" />

    {/* LEGS */}
    <rect x="83" y="248" width="15" height="26" rx="7" fill="#8e44ad" stroke="#6c3483" strokeWidth="1.5" />
    <rect x="102" y="248" width="15" height="26" rx="7" fill="#8e44ad" stroke="#6c3483" strokeWidth="1.5" />
    {/* shoes */}
    <ellipse cx="90" cy="274" rx="12" ry="6" fill="#4a235a" stroke="#2d1a3a" strokeWidth="1.5" />
    <ellipse cx="110" cy="274" rx="12" ry="6" fill="#4a235a" stroke="#2d1a3a" strokeWidth="1.5" />

    {/* DECORATIVE ELEMENTS */}
    <text x="20" y="85" fontSize="18" fill="#FFD700" opacity="0.8">
      ✦
    </text>
    <text x="170" y="75" fontSize="14" fill="#FF6B9D" opacity="0.8">
      ✦
    </text>
    <text x="15" y="160" fontSize="12" fill="#7FFFD4" opacity="0.7">
      ★
    </text>
    <text x="175" y="155" fontSize="10" fill="#FF8C42" opacity="0.7">
      ★
    </text>
    <circle cx="30" cy="100" r="4" fill="none" stroke="#FFD700" strokeWidth="1.5" opacity="0.6" />
    <circle cx="175" cy="100" r="3" fill="none" stroke="#FF6B9D" strokeWidth="1.5" opacity="0.6" />

    {/* pencil texture hatching on coat */}
    <path d="M68 210 L72 206 M72 218 L78 212 M76 226 L80 222" stroke="#ddd" strokeWidth="0.8" opacity="0.4" strokeLinecap="round" />
  </svg>
)

const KidWithBeaker = () => (
  <svg viewBox="0 0 200 280" fill="none" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 0 20px rgba(78,205,196,0.4))' }}>
    {/* glow rings */}
    <circle cx="100" cy="140" r="85" fill="rgba(78,205,196,0.06)" stroke="rgba(78,205,196,0.15)" strokeWidth="1" />

    {/* BODY */}
    <ellipse cx="100" cy="205" rx="38" ry="48" fill="#4ECDC4" stroke="#2ecc71" strokeWidth="2.5" />
    {/* striped shirt */}
    <path d="M62 190 Q62 245 100 250 Q138 245 138 190 Q122 198 100 198 Q78 198 62 190Z" fill="#3ab5ac" stroke="#2ecc71" strokeWidth="2" />
    <path d="M63 200 L137 200 M64 210 L136 210 M65 220 L135 220 M66 230 L134 230 M67 240 L133 240" stroke="#2d8a84" strokeWidth="2" opacity="0.4" />

    {/* HEAD */}
    <circle cx="100" cy="112" r="40" fill="#FFD4B2" stroke="#e8b890" strokeWidth="2.5" />
    {/* afro hair */}
    <ellipse cx="100" cy="92" rx="42" ry="30" fill="#1a0a00" stroke="#0d0500" strokeWidth="1.5" />
    <ellipse cx="85" cy="88" rx="15" ry="18" fill="#1a0a00" />
    <ellipse cx="115" cy="88" rx="15" ry="18" fill="#1a0a00" />
    <ellipse cx="100" cy="82" rx="20" ry="16" fill="#1a0a00" />
    <path d="M60 100 Q55 115 58 128" stroke="#1a0a00" strokeWidth="8" strokeLinecap="round" />
    <path d="M140 100 Q145 115 142 128" stroke="#1a0a00" strokeWidth="8" strokeLinecap="round" />

    {/* FACE */}
    <circle cx="88" cy="112" r="7" fill="#fff" />
    <circle cx="112" cy="112" r="7" fill="#fff" />
    <circle cx="89.5" cy="112" r="4" fill="#1a0a00" />
    <circle cx="113.5" cy="112" r="4" fill="#1a0a00" />
    <circle cx="91" cy="110" r="1.5" fill="#fff" />
    <circle cx="115" cy="110" r="1.5" fill="#fff" />
    {/* big grin */}
    <path d="M86 126 Q100 140 114 126" stroke="#c0392b" strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M86 126 Q100 140 114 126 Q100 136 86 126Z" fill="#e74c3c" opacity="0.4" />
    {/* teeth */}
    <path d="M90 128 L90 133 M95 130 L95 135 M100 131 L100 136 M105 130 L105 135 M110 128 L110 133" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
    {/* cheeks */}
    <circle cx="74" cy="120" r="9" fill="#FFB3A3" opacity="0.55" />
    <circle cx="126" cy="120" r="9" fill="#FFB3A3" opacity="0.55" />

    {/* ARMS */}
    <path d="M62 195 Q40 196 30 210" stroke="#FFD4B2" strokeWidth="14" strokeLinecap="round" />
    <path d="M138 195 Q162 194 172 205" stroke="#FFD4B2" strokeWidth="14" strokeLinecap="round" />
    <circle cx="28" cy="214" r="11" fill="#FFD4B2" stroke="#e8b890" strokeWidth="1.5" />
    <circle cx="174" cy="208" r="11" fill="#FFD4B2" stroke="#e8b890" strokeWidth="1.5" />

    {/* BIG COLOURFUL BEAKER */}
    {/* beaker body */}
    <path
      d="M150 170 L144 230 Q142 252 165 254 Q188 252 186 230 L180 170Z"
      fill="#a8e6cf"
      stroke="#27ae60"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* neck */}
    <rect x="152" y="155" width="28" height="18" rx="3" fill="#a8e6cf" stroke="#27ae60" strokeWidth="2" />
    {/* lip */}
    <rect x="148" y="152" width="36" height="7" rx="3" fill="#2ecc71" stroke="#27ae60" strokeWidth="1.5" />
    {/* liquid layers */}
    <path d="M146 210 L145 230 Q142 252 165 254 Q188 252 186 230 L184 210Z" fill="#2ecc71" opacity="0.55" />
    <path d="M147 225 L145 230 Q142 252 165 254 Q188 252 186 230 L184 225Z" fill="#27ae60" opacity="0.6" />
    {/* measurement lines */}
    <path d="M145 200 L150 200 M145 215 L150 215 M145 228 L150 228" stroke="#27ae60" strokeWidth="1.5" strokeLinecap="round" />
    <text x="152" y="203" fontSize="7" fill="#27ae60" fontFamily="monospace">
      300
    </text>
    <text x="152" y="218" fontSize="7" fill="#27ae60" fontFamily="monospace">
      200
    </text>
    {/* bubbles */}
    <circle cx="160" cy="228" r="5" stroke="#fff" strokeWidth="1.5" fill="rgba(255,255,255,0.3)" opacity="0.8" />
    <circle cx="170" cy="218" r="3.5" stroke="#fff" strokeWidth="1.2" fill="rgba(255,255,255,0.3)" opacity="0.7" />
    <circle cx="155" cy="238" r="4" stroke="#fff" strokeWidth="1.2" fill="rgba(255,255,255,0.3)" opacity="0.6" />
    <circle cx="175" cy="232" r="3" stroke="#fff" strokeWidth="1" fill="rgba(255,255,255,0.3)" opacity="0.5" />
    {/* rising bubbles outside */}
    <circle cx="165" cy="148" r="5" stroke="#4ECDC4" strokeWidth="1.5" fill="rgba(78,205,196,0.2)" />
    <circle cx="174" cy="136" r="4" stroke="#2ecc71" strokeWidth="1.2" fill="rgba(46,204,113,0.15)" />
    <circle cx="158" cy="130" r="3" stroke="#4ECDC4" strokeWidth="1" fill="rgba(78,205,196,0.1)" />
    <circle cx="170" cy="122" r="2.5" stroke="#27ae60" strokeWidth="1" fill="none" />
    {/* steam wisps */}
    <path d="M160 155 Q156 145 160 135 Q164 125 160 115" stroke="rgba(200,255,240,0.5)" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M168 154 Q172 142 168 130 Q164 118 168 108" stroke="rgba(200,255,240,0.4)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    {/* glow around beaker */}
    <ellipse cx="165" cy="215" rx="28" ry="40" fill="none" stroke="rgba(46,204,113,0.2)" strokeWidth="6" />

    {/* LEGS */}
    <rect x="83" y="248" width="15" height="26" rx="7" fill="#2d8a84" stroke="#1a5276" strokeWidth="1.5" />
    <rect x="102" y="248" width="15" height="26" rx="7" fill="#2d8a84" stroke="#1a5276" strokeWidth="1.5" />
    <ellipse cx="90" cy="274" rx="12" ry="6" fill="#1a5276" stroke="#0d2d4a" strokeWidth="1.5" />
    <ellipse cx="110" cy="274" rx="12" ry="6" fill="#1a5276" stroke="#0d2d4a" strokeWidth="1.5" />

    {/* DECORATIVES */}
    <text x="15" y="80" fontSize="20" fill="#FFD700" opacity="0.85">
      ✦
    </text>
    <text x="175" y="70" fontSize="14" fill="#4ECDC4" opacity="0.8">
      ✦
    </text>
    <text x="10" y="170" fontSize="12" fill="#FF6B9D" opacity="0.7">
      ★
    </text>
    <text x="182" y="160" fontSize="14" fill="#FFD700" opacity="0.7">
      ★
    </text>
    <circle cx="22" cy="110" r="5" fill="none" stroke="#4ECDC4" strokeWidth="2" opacity="0.6" />
    <circle cx="178" cy="120" r="4" fill="none" stroke="#27ae60" strokeWidth="1.5" opacity="0.6" />

    {/* pencil hatching on shirt */}
    <path d="M70 215 Q75 210 80 215 M72 225 Q78 220 83 225" stroke="#2d8a84" strokeWidth="0.8" opacity="0.35" />
  </svg>
)

const KidWithRocket = () => (
  <svg viewBox="0 0 200 290" fill="none" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 0 22px rgba(255,140,66,0.45))' }}>
    {/* glow rings */}
    <circle cx="100" cy="145" r="85" fill="rgba(255,140,66,0.06)" stroke="rgba(255,140,66,0.15)" strokeWidth="1" />

    {/* BODY */}
    <ellipse cx="100" cy="210" rx="36" ry="46" fill="#FF8C42" stroke="#e67322" strokeWidth="2.5" />
    {/* tshirt */}
    <path d="M64 196 Q64 248 100 252 Q136 248 136 196 Q120 204 100 204 Q80 204 64 196Z" fill="#fff" stroke="#ddd" strokeWidth="2" />
    {/* star on shirt */}
    <text x="88" y="228" fontSize="18" fill="#FFD700" opacity="0.8">
      ⭐
    </text>

    {/* HEAD */}
    <circle cx="100" cy="114" r="38" fill="#FDBCB4" stroke="#e8a090" strokeWidth="2.5" />
    {/* spiky hair */}
    <path d="M62 106 Q68 80 100 76 Q132 80 138 106 Q130 86 100 83 Q70 86 62 106Z" fill="#8B4513" stroke="#6b3410" strokeWidth="1.5" />
    <path d="M66 92 L60 74 L72 90" fill="#8B4513" stroke="#6b3410" strokeWidth="1" />
    <path d="M80 82 L78 62 L88 82" fill="#8B4513" stroke="#6b3410" strokeWidth="1" />
    <path d="M96 78 L96 58 L104 78" fill="#8B4513" stroke="#6b3410" strokeWidth="1" />
    <path d="M112 80 L118 60 L120 82" fill="#8B4513" stroke="#6b3410" strokeWidth="1" />
    <path d="M126 88 L136 72 L134 90" fill="#8B4513" stroke="#6b3410" strokeWidth="1" />
    <path d="M62 106 Q57 118 60 132" stroke="#8B4513" strokeWidth="7" strokeLinecap="round" />
    <path d="M138 106 Q143 118 140 132" stroke="#8B4513" strokeWidth="7" strokeLinecap="round" />

    {/* FACE */}
    <circle cx="88" cy="114" r="7" fill="#fff" />
    <circle cx="112" cy="114" r="7" fill="#fff" />
    <circle cx="89" cy="114" r="4" fill="#2d1b00" />
    <circle cx="113" cy="114" r="4" fill="#2d1b00" />
    <circle cx="90" cy="112" r="1.5" fill="#fff" />
    <circle cx="114" cy="112" r="1.5" fill="#fff" />
    {/* huge excited smile */}
    <path d="M84 128 Q100 146 116 128" stroke="#e07060" strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M84 128 Q100 148 116 128 Q100 144 84 128Z" fill="#e8756a" opacity="0.35" />
    {/* cheeks */}
    <circle cx="74" cy="122" r="9" fill="#FFB3A3" opacity="0.55" />
    <circle cx="126" cy="122" r="9" fill="#FFB3A3" opacity="0.55" />
    {/* freckles */}
    <circle cx="78" cy="118" r="1.5" fill="#c8956c" opacity="0.6" />
    <circle cx="82" cy="122" r="1.5" fill="#c8956c" opacity="0.6" />
    <circle cx="118" cy="118" r="1.5" fill="#c8956c" opacity="0.6" />
    <circle cx="122" cy="122" r="1.5" fill="#c8956c" opacity="0.6" />

    {/* ARMS - one raised holding rocket */}
    <path d="M64 200 Q46 194 38 180" stroke="#FDBCB4" strokeWidth="14" strokeLinecap="round" />
    <path d="M136 200 Q156 190 164 170" stroke="#FDBCB4" strokeWidth="14" strokeLinecap="round" />
    <circle cx="36" cy="177" r="11" fill="#FDBCB4" stroke="#e8a090" strokeWidth="1.5" />
    <circle cx="166" cy="167" r="11" fill="#FDBCB4" stroke="#e8a090" strokeWidth="1.5" />

    {/* BIG COLOURFUL ROCKET */}
    {/* rocket body */}
    <path d="M158 75 Q180 50 172 20 Q164 50 158 75Z" fill="#e74c3c" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M158 75 Q136 50 144 20 Q152 50 158 75Z" fill="#c0392b" stroke="#a93226" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="148" y="55" width="20" height="38" rx="4" fill="#e74c3c" stroke="#c0392b" strokeWidth="2" />
    <rect x="150" y="57" width="16" height="34" rx="3" fill="#cd6155" />
    {/* window porthole */}
    <circle cx="158" cy="68" r="9" fill="#85C1E9" stroke="#2980b9" strokeWidth="2.5" />
    <circle cx="158" cy="68" r="6" fill="#AED6F1" />
    <circle cx="155" cy="65" r="3" fill="#fff" opacity="0.7" />
    {/* fins */}
    <path d="M148 82 Q138 95 136 110 L148 100Z" fill="#f39c12" stroke="#d68910" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M168 82 Q178 95 180 110 L168 100Z" fill="#f39c12" stroke="#d68910" strokeWidth="1.5" strokeLinejoin="round" />
    {/* engine nozzle */}
    <path d="M150 93 L146 108 L170 108 L166 93Z" fill="#7f8c8d" stroke="#5d6d7e" strokeWidth="1.5" />
    <rect x="148" y="93" width="20" height="6" rx="2" fill="#5d6d7e" />
    {/* FLAMES big and colourful */}
    <path d="M150 108 Q158 135 148 145 Q158 128 158 150 Q158 128 168 145 Q158 135 166 108Z" fill="#FF6B00" opacity="0.95" />
    <path d="M152 108 Q158 128 150 140 Q158 122 158 142 Q158 122 166 140 Q160 128 164 108Z" fill="#FFD700" opacity="0.9" />
    <path d="M154 108 Q158 122 152 133 Q158 118 158 136 Q158 118 164 133 Q160 122 162 108Z" fill="#fff" opacity="0.7" />
    {/* flame glow */}
    <ellipse cx="158" cy="132" rx="14" ry="20" fill="rgba(255,140,0,0.2)" stroke="none" />
    {/* STARS TRAIL */}
    <text x="132" y="30" fontSize="14" fill="#FFD700" opacity="0.9">
      ✦
    </text>
    <text x="178" y="45" fontSize="10" fill="#FF6B9D" opacity="0.8">
      ✦
    </text>
    <text x="125" y="55" fontSize="12" fill="#7FFFD4" opacity="0.8">
      ★
    </text>
    <text x="185" y="65" fontSize="8" fill="#FFD700" opacity="0.7">
      ★
    </text>
    <circle cx="128" cy="40" r="3" fill="none" stroke="#FFD700" strokeWidth="1.5" opacity="0.7" />
    <circle cx="183" cy="35" r="2.5" fill="none" stroke="#FF6B9D" strokeWidth="1.2" opacity="0.6" />

    {/* LEGS */}
    <rect x="83" y="252" width="15" height="26" rx="7" fill="#e67322" stroke="#ca6010" strokeWidth="1.5" />
    <rect x="102" y="252" width="15" height="26" rx="7" fill="#e67322" stroke="#ca6010" strokeWidth="1.5" />
    <ellipse cx="90" cy="278" rx="12" ry="6" fill="#a04000" stroke="#7d3100" strokeWidth="1.5" />
    <ellipse cx="110" cy="278" rx="12" ry="6" fill="#a04000" stroke="#7d3100" strokeWidth="1.5" />

    {/* more stars */}
    <text x="20" y="80" fontSize="16" fill="#FFD700" opacity="0.8">
      ✦
    </text>
    <text x="18" y="160" fontSize="12" fill="#FF6B9D" opacity="0.7">
      ★
    </text>
    <circle cx="25" cy="105" r="4" fill="none" stroke="#FF8C42" strokeWidth="1.5" opacity="0.6" />
  </svg>
)

// v4 aliases (keep existing illustrations, new names)
const KidScope = KidWithMicroscope
const KidBeaker = KidWithBeaker
const KidRocket = KidWithRocket

const ScienceEquipmentBanner = () => (
  <svg viewBox="0 0 600 180" fill="none" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.3))' }}>
    {/* TEST TUBES */}
    <rect x="20" y="40" width="18" height="60" rx="9" fill="#FF6B9D" stroke="#d94f82" strokeWidth="2" />
    <rect x="20" y="70" width="18" height="30" rx="0" fill="#c0392b" opacity="0.45" />
    <circle cx="24" cy="78" r="3" fill="#fff" opacity="0.6" />
    <circle cx="30" cy="88" r="2" fill="#fff" opacity="0.5" />

    <rect x="44" y="32" width="18" height="68" rx="9" fill="#4ECDC4" stroke="#27ae60" strokeWidth="2" />
    <rect x="44" y="64" width="18" height="36" rx="0" fill="#1abc9c" opacity="0.45" />
    <circle cx="50" cy="72" r="3.5" fill="#fff" opacity="0.6" />
    <circle cx="56" cy="84" r="2" fill="#fff" opacity="0.5" />

    <rect x="68" y="44" width="18" height="56" rx="9" fill="#FFD700" stroke="#f39c12" strokeWidth="2" />
    <rect x="68" y="72" width="18" height="28" rx="0" fill="#e67e22" opacity="0.45" />
    <circle cx="74" cy="80" r="3" fill="#fff" opacity="0.6" />

    <rect x="92" y="36" width="18" height="64" rx="9" fill="#9b59b6" stroke="#7d3c98" strokeWidth="2" />
    <rect x="92" y="66" width="18" height="34" rx="0" fill="#6c3483" opacity="0.45" />
    <circle cx="100" cy="74" r="3" fill="#fff" opacity="0.6" />

    {/* rack */}
    <rect x="14" y="98" width="100" height="8" rx="4" fill="#5d6d7e" stroke="#2c3e50" strokeWidth="1.5" />
    <rect x="22" y="106" width="5" height="16" rx="2" fill="#5d6d7e" />
    <rect x="105" y="106" width="5" height="16" rx="2" fill="#5d6d7e" />

    {/* FLASK */}
    <path d="M160 50 L160 85 L138 120 Q132 132 145 136 L185 136 Q198 132 192 120 L170 85 L170 50Z" fill="#a8e6cf" stroke="#27ae60" strokeWidth="2.5" strokeLinecap="round" />
    <rect x="156" y="42" width="28" height="12" rx="4" fill="#a8e6cf" stroke="#27ae60" strokeWidth="2" />
    <path d="M156 42 L174 42" stroke="#2ecc71" strokeWidth="2" strokeLinecap="round" />
    {/* liquid */}
    <path d="M140 112 L138 120 Q132 132 145 136 L185 136 Q198 132 192 120 L188 112Z" fill="#2ecc71" opacity="0.5" />
    {/* bubbles */}
    <circle cx="155" cy="118" r="4" stroke="#fff" strokeWidth="1.5" fill="rgba(255,255,255,0.2)" />
    <circle cx="168" cy="108" r="3" stroke="#fff" strokeWidth="1.2" fill="rgba(255,255,255,0.2)" />
    <circle cx="178" cy="120" r="5" stroke="#fff" strokeWidth="1.5" fill="rgba(255,255,255,0.15)" />

    {/* ATOM */}
    <circle cx="280" cy="85" r="12" fill="#3498db" stroke="#2980b9" strokeWidth="2" />
    <circle cx="280" cy="85" r="7" fill="#85c1e9" />
    <circle cx="276" cy="82" r="3" fill="#fff" opacity="0.6" />
    <ellipse cx="280" cy="85" rx="48" ry="20" stroke="#e74c3c" strokeWidth="2.5" fill="none" />
    <ellipse cx="280" cy="85" rx="48" ry="20" stroke="#2ecc71" strokeWidth="2.5" fill="none" transform="rotate(60 280 85)" />
    <ellipse cx="280" cy="85" rx="48" ry="20" stroke="#9b59b6" strokeWidth="2.5" fill="none" transform="rotate(120 280 85)" />
    {/* electrons */}
    <circle cx="328" cy="85" r="6" fill="#e74c3c" stroke="#c0392b" strokeWidth="1.5" />
    <circle cx="256" cy="68" r="6" fill="#2ecc71" stroke="#27ae60" strokeWidth="1.5" />
    <circle cx="256" cy="102" r="6" fill="#9b59b6" stroke="#7d3c98" strokeWidth="1.5" />

    {/* MAGNIFYING GLASS */}
    <circle cx="420" cy="70" r="38" stroke="#f39c12" strokeWidth="4" fill="rgba(243,156,18,0.08)" />
    <circle cx="420" cy="70" r="30" stroke="rgba(243,156,18,0.3)" strokeWidth="1.5" fill="rgba(243,156,18,0.05)" />
    <circle cx="420" cy="70" r="22" stroke="rgba(243,156,18,0.2)" strokeWidth="1" fill="none" />
    {/* lens shine */}
    <path d="M408 55 Q414 50 424 54" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
    {/* handle */}
    <path d="M448 95 L476 130" stroke="#f39c12" strokeWidth="8" strokeLinecap="round" />
    <rect x="444" y="91" width="12" height="8" rx="4" fill="#e67e22" />
    {/* whats inside lens */}
    <text x="407" y="75" fontSize="24">
      🦠
    </text>

    {/* ROCKET small */}
    <path d="M530 30 Q545 10 540 -5 Q535 10 530 30Z" fill="#e74c3c" stroke="#c0392b" strokeWidth="1.5" />
    <path d="M530 30 Q515 10 520 -5 Q525 10 530 30Z" fill="#c0392b" stroke="#a93226" strokeWidth="1.5" />
    <rect x="522" y="18" width="16" height="22" rx="3" fill="#e74c3c" stroke="#c0392b" strokeWidth="1.5" />
    <circle cx="530" cy="25" r="6" fill="#85C1E9" stroke="#2980b9" strokeWidth="1.5" />
    <path d="M524 40 Q520 50 518 58 L524 52Z" fill="#f39c12" />
    <path d="M536 40 Q540 50 542 58 L536 52Z" fill="#f39c12" />
    <path d="M526 40 Q530 55 528 62 Q530 52 530 65 Q530 52 532 62 Q530 55 534 40Z" fill="#FF6B00" />
    <path d="M527 40 Q530 52 529 58 Q530 48 530 60 Q530 48 531 58 Q530 52 533 40Z" fill="#FFD700" opacity="0.9" />

    {/* SPARKLES everywhere */}
    <text x="128" y="48" fontSize="16" fill="#FFD700" opacity="0.9">
      ✦
    </text>
    <text x="210" y="38" fontSize="12" fill="#FF6B9D" opacity="0.8">
      ✦
    </text>
    <text x="370" y="42" fontSize="14" fill="#7FFFD4" opacity="0.8">
      ★
    </text>
    <text x="470" y="35" fontSize="18" fill="#FFD700" opacity="0.85">
      ✦
    </text>
    <text x="555" y="75" fontSize="12" fill="#FF6B9D" opacity="0.7">
      ★
    </text>
    <text x="490" y="140" fontSize="10" fill="#4ECDC4" opacity="0.7">
      ✦
    </text>
    <circle cx="240" cy="50" r="5" fill="none" stroke="#FFD700" strokeWidth="2" opacity="0.7" />
    <circle cx="380" cy="130" r="4" fill="none" stroke="#FF6B9D" strokeWidth="1.5" opacity="0.6" />
    <circle cx="505" cy="55" r="4" fill="none" stroke="#4ECDC4" strokeWidth="1.5" opacity="0.6" />
  </svg>
)

export default function BookPage() {
  const [step, setStep] = useState<Step>('date')
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(1)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bookingRef, setBookingRef] = useState('')

  const calendarDays = (() => {
    const { year, month } = currentMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const minDate = new Date(today)
    minDate.setDate(minDate.getDate() + MIN_DAYS)
    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + MAX_DAYS)
    const days: { date: Date | null; dateStr: string; bookable: boolean; isPast: boolean; tooFar: boolean }[] = []
    for (let i = 0; i < firstDay; i++) days.push({ date: null, dateStr: '', bookable: false, isPast: false, tooFar: false })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const dateStr = date.toISOString().split('T')[0]
      days.push({ date, dateStr, bookable: date >= minDate && date <= maxDate, isPast: date < minDate, tooFar: date > maxDate })
    }
    return days
  })()

  const canGoPrev = (() => {
    const t = new Date()
    return currentMonth.year > t.getFullYear() || currentMonth.month > t.getMonth()
  })()

  const canGoNext = (() => {
    const m = new Date()
    m.setDate(m.getDate() + MAX_DAYS)
    return currentMonth.year < m.getFullYear() || (currentMonth.year === m.getFullYear() && currentMonth.month < m.getMonth())
  })()

  useEffect(() => {
    if (!selectedDate) return
    supabase
      .from('sessions')
      .select('*')
      .eq('session_date', selectedDate)
      .then(({ data }) => setSessions(data || []))
  }, [selectedDate])

  const pollStatus = useCallback(() => {
    if (!bookingRef) return
    const iv = setInterval(async () => {
      const { data } = await supabase.from('bookings').select('payment_status').eq('booking_ref', bookingRef).single()
      if (data?.payment_status === 'paid') {
        clearInterval(iv)
        setStep('success')
      }
      if (data?.payment_status === 'failed') {
        clearInterval(iv)
        setError('Payment failed. Try again.')
        setStep('payment')
      }
    }, 3000)
    return () => clearInterval(iv)
  }, [bookingRef])

  useEffect(() => {
    if (step === 'pending') return pollStatus()
  }, [step, pollStatus])

  const total = adults * ADULT_PRICE + children * CHILD_PRICE
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
  const progressPct = { date: 8, slot: 30, count: 55, payment: 78, pending: 92, success: 100 }[step]

  async function handlePayment() {
    setError('')
    if (!phone || phone.replace(/\s/g, '').length < 9) {
      setError('Enter a valid M-Pesa phone number')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/mpesa/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedSession?.id, phone, name, adultCount: adults, childCount: children }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment failed')
      setBookingRef(data.bookingRef)
      setStep('pending')
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
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #07041a; overflow-x: hidden; }

        .page {
          min-height: 100vh;
          font-family: 'Nunito', sans-serif;
          color: #fff;
          background:
            radial-gradient(ellipse at 10% 0%, #2a0845 0%, transparent 50%),
            radial-gradient(ellipse at 90% 15%, #0a2d5c 0%, transparent 45%),
            radial-gradient(ellipse at 50% 100%, #0a1f06 0%, transparent 55%),
            #07041a;
        }

        .blob { position: fixed; border-radius: 50%; pointer-events: none; z-index: 0; filter: blur(90px); }
        .b1 { width:380px;height:380px;background:rgba(168,100,255,0.1);top:-80px;right:-80px;animation:blobdrift 22s ease-in-out infinite; }
        .b2 { width:320px;height:320px;background:rgba(78,205,196,0.09);bottom:0;left:-80px;animation:blobdrift 28s ease-in-out infinite -10s; }
        .b3 { width:280px;height:280px;background:rgba(255,140,66,0.07);top:40%;right:-60px;animation:blobdrift 24s ease-in-out infinite -6s; }
        @keyframes blobdrift { 0%,100%{transform:translate(0,0)} 50%{transform:translate(35px,-45px)} }

        .kid-float { position:fixed;pointer-events:none;z-index:1; }
        .kf1 { bottom:0;left:0;width:160px;height:220px;animation:kidfloat 20s ease-in-out infinite; }
        .kf2 { bottom:0;right:0;width:155px;height:215px;animation:kidfloat 24s ease-in-out infinite -8s; }
        .kf3 { top:15%;left:0;width:140px;height:200px;animation:kidfloat 18s ease-in-out infinite -4s;opacity:0.5; }
        @keyframes kidfloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-16px)} }

        .hdr { position:relative;z-index:20;background:rgba(7,4,26,0.85);backdrop-filter:blur(24px);border-bottom:1px solid rgba(255,255,255,0.06); }
        .hdr-wrap { max-width:1100px;margin:0 auto;display:flex;align-items:center;padding:14px 32px;gap:16px; }
        .hdr-logo { width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#FF4080,#FF8C00,#FFD700);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;animation:logopop 2.5s ease-in-out infinite;box-shadow:0 0 36px rgba(255,150,0,0.55); }
        @keyframes logopop { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-5px) scale(1.06)} }
        .hdr-name { font-family:'Fredoka One',cursive;font-size:26px;background:linear-gradient(90deg,#FF6B9D,#FF8C00,#FFD700,#7FFFD4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .hdr-sub { font-size:12px;color:rgba(255,255,255,0.4);margin-top:2px; }
        .hdr-right { margin-left:auto;display:flex;gap:10px;align-items:center; }
        .hdr-pill { padding:6px 14px;border-radius:20px;font-size:11px;font-weight:800;letter-spacing:0.04em; }
        .hp-gold { background:linear-gradient(135deg,#FFD700,#FF8C00);color:#2d1b00; }
        .hp-teal { background:linear-gradient(135deg,#4ECDC4,#27ae60);color:#0a2d1a; }
        .prog-bar { height:5px;background:rgba(255,255,255,0.06); }
        .prog-fill { height:100%;background:linear-gradient(90deg,#FF4080,#FF8C00,#FFD700);transition:width 0.7s cubic-bezier(0.34,1.56,0.64,1); }

        .outer { max-width:1100px;margin:0 auto;padding:0 32px 80px; }

        .hero { display:grid;grid-template-columns:1fr 2fr 1fr;gap:0;align-items:end;padding:40px 0 0; }
        .hero-side { height:260px; }
        .hero-side.left { display:flex;justify-content:flex-end;padding-right:12px; }
        .hero-side.right { display:flex;justify-content:flex-start;padding-left:12px; }
        .hero-center { text-align:center;padding:0 16px 20px; }
        .hero-h { font-family:'Fredoka One',cursive;font-size:clamp(34px,4.5vw,58px);line-height:1.1;margin-bottom:14px; }
        .hero-h .l1 { display:block;background:linear-gradient(90deg,#FF6B9D,#FF8C00);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .hero-h .l2 { display:block;background:linear-gradient(90deg,#FFD700,#7FFFD4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .hero-sub { font-size:16px;color:rgba(255,255,255,0.58);line-height:1.6;margin-bottom:22px; }
        .hero-pills { display:flex;gap:10px;justify-content:center;flex-wrap:wrap; }
        .hp { display:inline-flex;align-items:center;gap:7px;padding:8px 18px;border-radius:24px;font-size:13px;font-weight:800;border:1px solid; }
        .hp1 { background:rgba(255,107,157,0.12);border-color:rgba(255,107,157,0.3);color:#FF6B9D; }
        .hp2 { background:rgba(255,215,0,0.1);border-color:rgba(255,215,0,0.25);color:#FFD700; }
        .hp3 { background:rgba(127,255,212,0.1);border-color:rgba(127,255,212,0.25);color:#7FFFD4; }

        .equip { position:relative;z-index:5;margin-bottom:32px; }
        .equip-inner { background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:22px;padding:18px 28px;display:flex;gap:28px;overflow-x:auto;scrollbar-width:none; }
        .equip-inner::-webkit-scrollbar { display:none; }
        .eq { display:flex;flex-direction:column;align-items:center;gap:7px;flex-shrink:0;animation:eqbounce var(--d,3s) ease-in-out infinite var(--del,0s); }
        @keyframes eqbounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        .eq-icon { font-size:36px;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.4)); }
        .eq-label { font-size:11px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap; }

        .bcard { position:relative;z-index:5;background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.1);border-radius:28px;padding:38px 44px;backdrop-filter:blur(12px);box-shadow:0 24px 90px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.04) inset;overflow:hidden; }
        .bcard::before { content:'';position:absolute;top:-1px;left:15%;right:15%;height:3px;background:linear-gradient(90deg,transparent,#FF6B9D,#FFD700,#7FFFD4,transparent);border-radius:3px; }

        .step-pill { display:inline-flex;align-items:center;gap:8px;background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.22);color:#FFD700;font-size:12px;font-weight:800;padding:6px 16px;border-radius:24px;margin-bottom:20px;text-transform:uppercase;letter-spacing:0.1em; }
        .step-num-row { display:flex;gap:8px;margin-bottom:18px; }
        .step-dot { height:5px;border-radius:3px;transition:all 0.4s; }
        .step-dot.done { background:linear-gradient(90deg,#FF6B9D,#FFD700);flex:1; }
        .step-dot.active { background:linear-gradient(90deg,#FF6B9D,#FFD700);flex:2;animation:dotpulse 1.5s ease-in-out infinite; }
        @keyframes dotpulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        .step-dot.todo { background:rgba(255,255,255,0.12);flex:1; }

        .step-title { font-family:'Fredoka One',cursive;font-size:clamp(28px,3.4vw,40px);line-height:1.15;margin-bottom:8px; }
        .step-title span { background:linear-gradient(90deg,#FF6B9D,#FFD700);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .step-sub { font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:18px;line-height:1.55; }

        .cal-nav-row { display:flex;align-items:center;justify-content:space-between;margin-bottom:24px; }
        .cal-nav-row { margin-bottom:14px; }
        .cal-month { font-family:'Fredoka One',cursive;font-size:22px;background:linear-gradient(90deg,#FF6B9D,#FFD700);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .cal-nav-btn { background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:#fff;width:38px;height:38px;border-radius:12px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;font-family:'Nunito',sans-serif;font-weight:900; }
        .cal-nav-btn:hover { background:rgba(255,107,157,0.2);border-color:rgba(255,107,157,0.5);transform:scale(1.06); }
        .cal-nav-btn:disabled { opacity:0.2;cursor:not-allowed;transform:none; }
        .cal-grid { display:grid;grid-template-columns:repeat(7,1fr);gap:6px; }
        .cal-dow { text-align:center;font-size:11px;font-weight:800;color:rgba(255,255,255,0.3);padding:4px 0 10px;text-transform:uppercase;letter-spacing:0.05em; }
        .cal-day { aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:14px;transition:all 0.2s;border:2px solid transparent;cursor:default;position:relative; }
        .cal-day-num { font-size:14px;font-weight:900;line-height:1; }
        .cal-day-dot { width:6px;height:6px;border-radius:50%;margin-top:4px; }
        .cal-day.bookable { background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.1);cursor:pointer; }
        .cal-day.bookable:hover { transform:scale(1.12);box-shadow:0 8px 24px rgba(255,107,157,0.32);background:rgba(255,107,157,0.16);border-color:rgba(255,107,157,0.6); }
        .cal-day.bookable:hover .cal-day-num { background:linear-gradient(90deg,#FF6B9D,#FFD700);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .cal-day.bookable .cal-day-dot { background:rgba(255,255,255,0.25); }
        .cal-day.wknd { background:rgba(127,255,212,0.07);border-color:rgba(127,255,212,0.18); }
        .cal-day.wknd .cal-day-num { background:linear-gradient(90deg,#7FFFD4,#00bfff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .cal-day.wknd .cal-day-dot { background:#7FFFD4; }
        .cal-day.wknd:hover { background:rgba(127,255,212,0.18);border-color:rgba(127,255,212,0.6);box-shadow:0 8px 28px rgba(127,255,212,0.3); }
        .cal-day.selected { background:linear-gradient(135deg,rgba(255,107,157,0.28),rgba(255,215,0,0.16));border-color:#FF6B9D;transform:scale(1.10);box-shadow:0 10px 28px rgba(255,107,157,0.36); }
        .cal-day.selected .cal-day-num { background:linear-gradient(90deg,#FF6B9D,#FFD700);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .cal-day.past,.cal-day.toofar { opacity:0.14; }
        .cal-day.empty { border:none;background:none; }
        .cal-legend { display:flex;gap:18px;margin-top:12px; }
        .leg { display:flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,0.42);font-weight:700; }
        .leg-sq { width:14px;height:14px;border-radius:5px; }

        .slot-card { display:flex;align-items:center;gap:22px;border-radius:22px;padding:26px 30px;margin-bottom:16px;cursor:pointer;transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1);border:2px solid transparent;position:relative;overflow:hidden; }
        .slot-card.s0 { background:rgba(255,107,157,0.08);border-color:rgba(255,107,157,0.2); }
        .slot-card.s1 { background:rgba(255,215,0,0.08);border-color:rgba(255,215,0,0.2); }
        .slot-card.s2 { background:rgba(127,255,212,0.08);border-color:rgba(127,255,212,0.2); }
        .slot-card.s0:hover { border-color:#FF6B9D;box-shadow:0 10px 40px rgba(255,107,157,0.3);transform:translateX(10px) scale(1.02); }
        .slot-card.s1:hover { border-color:#FFD700;box-shadow:0 10px 40px rgba(255,215,0,0.3);transform:translateX(10px) scale(1.02); }
        .slot-card.s2:hover { border-color:#7FFFD4;box-shadow:0 10px 40px rgba(127,255,212,0.3);transform:translateX(10px) scale(1.02); }
        .slot-card.blocked { opacity:0.3;cursor:not-allowed;pointer-events:none; }
        .slot-emoji { font-size:44px;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.35));animation:slotpop var(--sd,2.5s) ease-in-out infinite; }
        @keyframes slotpop { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-7px) scale(1.06)} }
        .slot-label h3 { font-family:'Fredoka One',cursive;font-size:22px;margin-bottom:5px; }
        .slot-label p { font-size:14px;color:rgba(255,255,255,0.48); }
        .slot-arr { margin-left:auto;font-size:28px;font-weight:900;opacity:0.3;transition:all 0.2s; }
        .slot-card:hover .slot-arr { opacity:0.8;transform:translateX(6px); }

        .ctr-wrap { margin-bottom:14px; }
        .ctr-card { display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.09);border-radius:22px;padding:24px 30px;transition:all 0.2s; }
        .ctr-card:hover { background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.16); }
        .ctr-label h3 { font-family:'Fredoka One',cursive;font-size:22px;margin-bottom:5px; }
        .ctr-label p { font-size:14px;margin-top:0; }
        .ctr-ctrl { display:flex;align-items:center;gap:20px; }
        .cnt-btn { width:52px;height:52px;border-radius:16px;border:2px solid;cursor:pointer;font-size:26px;font-weight:900;display:flex;align-items:center;justify-content:center;transition:all 0.15s cubic-bezier(0.34,1.56,0.64,1);font-family:'Nunito',sans-serif; }
        .cnt-btn:hover { transform:scale(1.25); }
        .cnt-btn.a { background:rgba(255,107,157,0.12);border-color:rgba(255,107,157,0.45);color:#FF6B9D; }
        .cnt-btn.a:hover { background:rgba(255,107,157,0.28); }
        .cnt-btn.c { background:rgba(127,255,212,0.12);border-color:rgba(127,255,212,0.45);color:#7FFFD4; }
        .cnt-btn.c:hover { background:rgba(127,255,212,0.28); }
        .cnt-val { font-family:'Fredoka One',cursive;font-size:34px;min-width:44px;text-align:center; }

        .total-box { display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,rgba(255,107,157,0.1),rgba(255,215,0,0.07));border:2px solid rgba(255,165,0,0.22);border-radius:22px;padding:22px 30px;margin:22px 0 28px; }
        .total-lbl { font-size:16px;color:rgba(255,255,255,0.58);font-weight:700; }
        .total-amt { font-family:'Fredoka One',cursive;font-size:40px;background:linear-gradient(90deg,#FF6B9D,#FFD700);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }

        .ls-in { display:block;width:100%;background:rgba(255,255,255,0.07);border:2px solid rgba(255,255,255,0.11);border-radius:18px;padding:18px 22px;color:#fff;font-size:17px;margin-bottom:16px;font-family:'Nunito',sans-serif;font-weight:600;transition:all 0.2s; }
        .ls-in:focus { outline:none;border-color:rgba(255,107,157,0.65);background:rgba(255,255,255,0.1);box-shadow:0 0 0 5px rgba(255,107,157,0.12); }
        .ls-in::placeholder { color:rgba(255,255,255,0.25); }

        .sum { background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:20px;padding:24px 28px;margin-bottom:22px; }
        .sum h4 { font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);margin-bottom:16px;font-weight:800; }
        .sum-row { display:flex;justify-content:space-between;font-size:15px;color:rgba(255,255,255,0.6);margin-bottom:10px;font-weight:600; }
        .sum-row.b { font-weight:900;color:#fff;font-size:18px;border-top:1px solid rgba(255,255,255,0.09);padding-top:14px;margin-top:6px; }

        .btn-go { display:block;width:100%;background:linear-gradient(135deg,#FF4080,#FF8C00);color:#fff;border:none;border-radius:20px;padding:22px;font-family:'Fredoka One',cursive;font-size:22px;cursor:pointer;transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 8px 36px rgba(255,64,128,0.4);letter-spacing:0.03em; }
        .btn-go:hover { transform:translateY(-4px) scale(1.02);box-shadow:0 16px 52px rgba(255,64,128,0.55); }
        .btn-go:disabled { opacity:0.6;transform:none;cursor:not-allowed; }
        .btn-back { background:none;border:none;color:rgba(255,255,255,0.38);cursor:pointer;font-size:15px;font-family:'Nunito',sans-serif;margin-bottom:24px;padding:0;font-weight:800;display:flex;align-items:center;gap:6px;transition:color 0.2s; }
        .btn-back:hover { color:rgba(255,255,255,0.75); }
        .btn-ghost { display:block;width:100%;background:transparent;color:rgba(255,255,255,0.32);border:none;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;margin-top:12px;border-radius:16px;transition:all 0.2s; }
        .btn-ghost:hover { background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.6); }

        .warn { background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);color:#FFD700;font-size:14px;padding:14px 20px;border-radius:16px;margin-bottom:24px;font-weight:700;line-height:1.5; }
        .err { color:#FF6B9D;font-size:15px;margin-bottom:16px;padding:14px 20px;background:rgba(255,107,157,0.08);border-radius:14px;border:1px solid rgba(255,107,157,0.22);font-weight:700; }

        .pend { text-align:center;padding:60px 0 20px; }
        .pend .big { font-size:100px;margin-bottom:24px;animation:bigpop 1.5s ease-in-out infinite; }
        @keyframes bigpop { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-18px) scale(1.06)} }
        .pend h2 { font-family:'Fredoka One',cursive;font-size:38px;margin-bottom:14px; }
        .pend p { color:rgba(255,255,255,0.52);font-size:16px;line-height:1.7; }
        .dots { display:flex;justify-content:center;gap:10px;margin-top:30px; }
        .dot { width:12px;height:12px;border-radius:50%;animation:dotpp 1.2s ease-in-out infinite; }
        .d1{background:#FF6B9D} .d2{background:#FFD700;animation-delay:0.2s} .d3{background:#7FFFD4;animation-delay:0.4s}
        @keyframes dotpp { 0%,100%{opacity:0.2;transform:scale(0.6)} 50%{opacity:1;transform:scale(1.5)} }

        .succ { text-align:center;padding:40px 0 20px; }
        .succ .big { font-size:100px;margin-bottom:16px;animation:popin 0.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
        @keyframes popin { 0%{transform:scale(0) rotate(-15deg)} 100%{transform:scale(1) rotate(0)} }
        .succ h2 { font-family:'Fredoka One',cursive;font-size:40px;background:linear-gradient(90deg,#7FFFD4,#00bfff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:10px; }
        .ref-card { background:rgba(255,215,0,0.08);border:2px solid rgba(255,215,0,0.28);border-radius:20px;padding:20px 28px;margin:22px 0;text-align:left; }
        .ref-card .rl { font-size:12px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;font-weight:800; }
        .ref-card .rv { font-family:'Fredoka One',cursive;font-size:32px;color:#FFD700;letter-spacing:0.12em; }
        .venue-note { margin-top:22px;padding:18px;background:rgba(127,255,212,0.04);border:1px solid rgba(127,255,212,0.12);border-radius:16px;font-size:14px;color:rgba(255,255,255,0.38);text-align:center;line-height:2;font-weight:600; }

        .feat-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-top:32px; }
        .feat-card { background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:18px;padding:20px 16px;text-align:center;transition:all 0.25s; }
        .feat-card:hover { transform:translateY(-6px);background:rgba(255,255,255,0.06); }
        .feat-icon { font-size:32px;margin-bottom:10px; }
        .feat-title { font-family:'Fredoka One',cursive;font-size:16px;margin-bottom:4px; }
        .feat-sub { font-size:12px;color:rgba(255,255,255,0.4);font-weight:600; }

        @media(max-width:768px){
          .outer{padding:0 16px 60px}
          .hero{grid-template-columns:1fr}
          .hero-side{display:none}
          .bcard{padding:32px 24px}
          .hdr-right{display:none}
          .kf1,.kf2,.kf3{display:none}
          .cal-day-num{font-size:14px}
          .slot-card{padding:20px 20px}
          .slot-emoji{font-size:36px}
          .ctr-card{padding:18px 20px}
          .cnt-btn{width:44px;height:44px}
          .cnt-val{font-size:28px}
          .total-amt{font-size:32px}
        }
        @media(max-width:420px){
          .cal-grid{gap:5px}
          .cal-day-num{font-size:13px}
        }
      `}</style>

      <div className="page">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />

        <div className="kid-float kf1"><KidBeaker /></div>
        <div className="kid-float kf2"><KidRocket /></div>
        <div className="kid-float kf3"><KidScope /></div>

        <div className="hdr">
          <div className="hdr-wrap">
            <div className="hdr-logo">🔬</div>
            <div>
              <div className="hdr-name">Little Scientist</div>
              <div className="hdr-sub">Children's Science Park · Sabaki, Mombasa Road · littlescientist.ke</div>
            </div>
            <div className="hdr-right">
              <div className="hdr-pill hp-gold">⭐ Award Winning</div>
              <div className="hdr-pill hp-teal">🌍 Global Standard</div>
            </div>
          </div>
          <div className="prog-bar"><div className="prog-fill" style={{ width: `${progressPct}%` }} /></div>
        </div>

        <div className="outer">
          {step === 'date' && (
            <div className="hero">
              <div className="hero-side left"><KidScope /></div>
              <div className="hero-center">
                <h1 className="hero-h">
                  <span className="l1">Discover. Explore.</span>
                  <span className="l2">Experiment!</span>
                </h1>
                <p className="hero-sub">Kenya's premier children's science park — where young minds ignite. Book your family adventure today.</p>
                <div className="hero-pills">
                  <div className="hp hp1">🧪 50+ Experiments</div>
                  <div className="hp hp2">🚀 Space & Rockets</div>
                  <div className="hp hp3">🌿 Nature Lab</div>
                </div>
              </div>
              <div className="hero-side right"><KidRocket /></div>
            </div>
          )}

          {step === 'date' && (
            <div className="equip" style={{ marginTop: 28 }}>
              <div className="equip-inner">
                {[
                  { i: '🔭', l: 'Telescope', d: '2.4s', dl: '0s' },
                  { i: '⚗️', l: 'Chemistry', d: '3s', dl: '0.3s' },
                  { i: '🧲', l: 'Magnetics', d: '2.7s', dl: '0.6s' },
                  { i: '🦠', l: 'Biology', d: '3.3s', dl: '0.9s' },
                  { i: '⚡', l: 'Electricity', d: '2.5s', dl: '1.2s' },
                  { i: '🌋', l: 'Geology', d: '3.5s', dl: '0.4s' },
                  { i: '🧬', l: 'DNA & Genetics', d: '2.9s', dl: '0.7s' },
                  { i: '🤖', l: 'Robotics', d: '3.1s', dl: '1s' },
                  { i: '🌊', l: 'Oceanography', d: '2.8s', dl: '0.2s' },
                  { i: '🌞', l: 'Solar Energy', d: '3.4s', dl: '0.5s' },
                  { i: '🎨', l: 'Science Art', d: '2.6s', dl: '0.8s' },
                  { i: '🧊', l: 'Cryogenics', d: '3.2s', dl: '1.1s' },
                ].map(({ i, l, d, dl }) => (
                  <div className="eq" key={l} style={{ ['--d' as any]: d, ['--del' as any]: dl }}>
                    <div className="eq-icon">{i}</div>
                    <div className="eq-label">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bcard">
            <div className="step-num-row">
              {(['date', 'slot', 'count', 'payment'] as Step[]).map(s => {
                const stepOrder: Step[] = ['date', 'slot', 'count', 'payment', 'pending', 'success']
                const cur = stepOrder.indexOf(step)
                const mine = stepOrder.indexOf(s)
                return <div key={s} className={`step-dot ${mine < cur ? 'done' : mine === cur ? 'active' : 'todo'}`} />
              })}
            </div>

            {step === 'date' && (
              <>
                <div className="step-pill">📅 Step 1 of 4</div>
                <h2 className="step-title">Choose your <span>adventure day</span></h2>
                <p className="step-sub">Browse the full month — book 1–30 days ahead. Weekend sessions fill up first!</p>

                <div className="cal-nav-row">
                  <button className="cal-nav-btn" onClick={() => setCurrentMonth(m => { const d = new Date(m.year, m.month - 1); return { year: d.getFullYear(), month: d.getMonth() } })} disabled={!canGoPrev}>‹</button>
                  <div className="cal-month">{monthName}</div>
                  <button className="cal-nav-btn" onClick={() => setCurrentMonth(m => { const d = new Date(m.year, m.month + 1); return { year: d.getFullYear(), month: d.getMonth() } })} disabled={!canGoNext}>›</button>
                </div>

                <div className="cal-grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="cal-dow">{d}</div>)}
                  {calendarDays.map((day, i) => {
                    if (!day.date) return <div key={`e${i}`} className="cal-day empty" />
                    const dow = day.date.getDay()
                    const isW = dow === 0 || dow === 6
                    const isSel = day.dateStr === selectedDate
                    let cls = 'cal-day'
                    if (day.isPast) cls += ' past'
                    else if (day.tooFar) cls += ' toofar'
                    else {
                      cls += ' bookable'
                      if (isW) cls += ' wknd'
                      if (isSel) cls += ' selected'
                    }
                    return (
                      <div key={day.dateStr} className={cls} onClick={() => { if (day.bookable) { setSelectedDate(day.dateStr); setStep('slot') } }}>
                        <div className="cal-day-num">{day.date.getDate()}</div>
                        {day.bookable && <div className="cal-day-dot" />}
                      </div>
                    )
                  })}
                </div>

                <div className="cal-legend">
                  <div className="leg"><div className="leg-sq" style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)' }} /> Available</div>
                  <div className="leg"><div className="leg-sq" style={{ background: 'rgba(127,255,212,0.22)', border: '1px solid rgba(127,255,212,0.35)' }} /> Weekend ⭐</div>
                  <div className="leg"><div className="leg-sq" style={{ background: 'rgba(255,255,255,0.04)' }} /> Unavailable</div>
                </div>
              </>
            )}

            {step === 'slot' && (
              <>
                <button className="btn-back" onClick={() => setStep('date')}>← Back</button>
                <div className="step-pill">🕙 Step 2 of 4</div>
                <h2 className="step-title">Pick your <span>session time</span></h2>
                <p className="step-sub">{new Date(selectedDate).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })} — three sessions daily, each 2 hours.</p>

                {(['10:00-12:00', '12:00-14:00', '14:00-16:00'] as const).map((slot, idx) => {
                  const session = sessions.find(s => s.time_slot === slot) || null
                  const available = session ? session.capacity - session.booked_count : 100
                  const blocked = session?.is_blocked || available <= 0
                  const emojis = ['🌅', '☀️', '🌤️']
                  const colors = ['#FF6B9D', '#FFD700', '#7FFFD4']
                  const delays = ['2.4s', '2.8s', '3.2s']
                  return (
                    <div
                      key={slot}
                      className={`slot-card s${idx}${blocked ? ' blocked' : ''}`}
                      style={{ ['--sd' as any]: delays[idx] }}
                      onClick={() => { if (!blocked) { setSelectedSession(session); setStep('count') } }}
                    >
                      <div className="slot-emoji">{emojis[idx]}</div>
                      <div className="slot-label">
                        <h3 style={{ color: colors[idx] }}>{SLOT_LABELS[slot]}</h3>
                        <p>{blocked ? '🔴 Full / Unavailable' : `🟢 ${available} spots remaining`}</p>
                      </div>
                      {!blocked && <div className="slot-arr" style={{ color: colors[idx] }}>›</div>}
                    </div>
                  )
                })}
              </>
            )}

            {step === 'count' && (
              <>
                <button className="btn-back" onClick={() => setStep('slot')}>← Back</button>
                <div className="step-pill">👨‍👩‍👧 Step 3 of 4</div>
                <h2 className="step-title">Who's <span>joining the adventure?</span></h2>
                <div className="warn">⚠️ Every booking requires at least 1 adult AND 1 child — no exceptions!</div>

                <div className="ctr-wrap">
                  <div className="ctr-card">
                    <div className="ctr-label">
                      <h3>🧑 Adults</h3>
                      <p style={{ color: '#FF6B9D', fontWeight: 700, fontSize: 15 }}>KES {ADULT_PRICE.toLocaleString()} per person</p>
                    </div>
                    <div className="ctr-ctrl">
                      <button className="cnt-btn a" onClick={() => setAdults(Math.max(1, adults - 1))}>−</button>
                      <span className="cnt-val">{adults}</span>
                      <button className="cnt-btn a" onClick={() => setAdults(adults + 1)}>+</button>
                    </div>
                  </div>
                </div>

                <div className="ctr-wrap">
                  <div className="ctr-card">
                    <div className="ctr-label">
                      <h3>👧 Children</h3>
                      <p style={{ color: '#7FFFD4', fontWeight: 700, fontSize: 15 }}>KES {CHILD_PRICE.toLocaleString()} per person</p>
                    </div>
                    <div className="ctr-ctrl">
                      <button className="cnt-btn c" onClick={() => setChildren(Math.max(1, children - 1))}>−</button>
                      <span className="cnt-val">{children}</span>
                      <button className="cnt-btn c" onClick={() => setChildren(children + 1)}>+</button>
                    </div>
                  </div>
                </div>

                <div className="total-box">
                  <div className="total-lbl">Total to pay</div>
                  <div className="total-amt">KES {total.toLocaleString()}</div>
                </div>

                <button className="btn-go" onClick={() => setStep('payment')}>Continue to payment →</button>
              </>
            )}

            {step === 'payment' && (
              <>
                <button className="btn-back" onClick={() => setStep('count')}>← Back</button>
                <div className="step-pill">💳 Step 4 of 4</div>
                <h2 className="step-title">Pay with <span>M-Pesa</span></h2>
                <p className="step-sub">Enter your M-Pesa number — you'll get a payment prompt on your phone instantly.</p>

                <input className="ls-in" placeholder="Your name (optional)" value={name} onChange={e => setName(e.target.value)} />
                <input className="ls-in" placeholder="M-Pesa number e.g. 0700 101 425" value={phone} onChange={e => setPhone(e.target.value)} type="tel" />

                <div className="sum">
                  <h4>Booking summary</h4>
                  <div className="sum-row"><span>📅 Date</span><span>{new Date(selectedDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                  <div className="sum-row"><span>🕙 Time</span><span>{SLOT_LABELS[selectedSession?.time_slot || '10:00-12:00']}</span></div>
                  <div className="sum-row"><span>🧑 Adults × {adults}</span><span>KES {(adults * ADULT_PRICE).toLocaleString()}</span></div>
                  <div className="sum-row"><span>👧 Children × {children}</span><span>KES {(children * CHILD_PRICE).toLocaleString()}</span></div>
                  <div className="sum-row b"><span>Total</span><span>KES {total.toLocaleString()}</span></div>
                </div>

                {error && <div className="err">{error}</div>}
                <button className="btn-go" onClick={handlePayment} disabled={loading}>
                  {loading ? '🔄 Sending prompt...' : `🔬 Pay KES ${total.toLocaleString()} →`}
                </button>
                <button className="btn-ghost" onClick={() => setStep('count')}>← Change visitors</button>
              </>
            )}

            {step === 'pending' && (
              <div className="pend">
                <div className="big">📱</div>
                <h2>Check your phone!</h2>
                <p>
                  M-Pesa prompt sent to<br /><strong style={{ color: '#FFD700', fontSize: 20 }}>{phone}</strong>
                </p>
                <p style={{ marginTop: 14 }}>
                  Enter your PIN to confirm<br /><strong style={{ color: '#FF6B9D', fontSize: 24 }}>KES {total.toLocaleString()}</strong>
                </p>
                <div className="dots"><span className="dot d1" /><span className="dot d2" /><span className="dot d3" /></div>
                <p style={{ marginTop: 18, fontSize: 14, color: 'rgba(255,255,255,0.22)' }}>Waiting for confirmation — usually 30–60 seconds</p>
              </div>
            )}

            {step === 'success' && (
              <div className="succ">
                <div className="big">🎉</div>
                <h2>You are all set!</h2>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16 }}>Booking confirmed! Your QR tickets are ready below.</p>
                <div className="ref-card">
                  <div className="rl">Booking reference</div>
                  <div className="rv">{bookingRef}</div>
                </div>
                <div className="sum" style={{ textAlign: 'left' }}>
                  <div className="sum-row"><span>📅</span><span>{new Date(selectedDate).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
                  <div className="sum-row"><span>🕙</span><span>{SLOT_LABELS[selectedSession?.time_slot || '10:00-12:00']}</span></div>
                  <div className="sum-row"><span>👨‍👩‍👧</span><span>{adults} adult{adults > 1 ? 's' : ''} · {children} child{children > 1 ? 'ren' : ''}</span></div>
                </div>
                <a href={`/ticket/${bookingRef}`} className="btn-go" style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                  🎟️ View tickets and QR codes →
                </a>
                <div className="venue-note">
                  📍 Sabaki Estate, Mombasa Road · 📞 Dr. Syokau Ilovi — 0700 101 425<br />
                  🌐 littlescientist.ke
                </div>
              </div>
            )}
          </div>

          {step === 'date' && (
            <div className="feat-grid">
              {[
                { i: '🧪', t: '50+ Experiments', s: 'New activities every visit' },
                { i: '👨‍🔬', t: 'Expert Educators', s: 'Trained science guides' },
                { i: '🏆', t: 'Award Winning', s: 'Best kids attraction 2024' },
                { i: '🌍', t: 'Global Standards', s: 'World-class safety' },
                { i: '📱', t: 'Cashless Only', s: 'M-Pesa powered' },
                { i: '✅', t: 'All Ages Welcome', s: 'Ages 3–16 years' },
              ].map(({ i, t, s }) => (
                <div className="feat-card" key={t}>
                  <div className="feat-icon">{i}</div>
                  <div className="feat-title">{t}</div>
                  <div className="feat-sub">{s}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
