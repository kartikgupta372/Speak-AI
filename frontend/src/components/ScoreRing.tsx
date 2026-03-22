'use client'
import { useEffect, useState } from 'react'

interface Props { score: number; label: string; size?: number; color?: string }

export default function ScoreRing({ score, label, size=80, color='#06B6D4' }: Props) {
  const [anim, setAnim] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnim(true), 120); return () => clearTimeout(t) }, [])

  const sw = 6, r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - (anim ? score / 100 : 0))

  const c = score >= 80 ? '#06B6D4' : score >= 60 ? '#818CF8' : score >= 40 ? '#F59E0B' : '#EF4444'

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
      <div style={{ position:'relative', width:size, height:size }}>
        <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={sw}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition:'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
        </svg>
        <div style={{
          position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'Syne,serif', fontWeight:700, color:'white', fontSize: size * 0.22
        }}>{Math.round(score)}</div>
      </div>
      <span style={{ fontSize:10, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>
        {label}
      </span>
    </div>
  )
}
