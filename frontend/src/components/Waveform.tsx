'use client'

const DELAYS = ['0ms','120ms','240ms','120ms','0ms','180ms','60ms','240ms','30ms','180ms']

interface WaveformProps {
  bars?: number
  active?: boolean
  color?: string   // css color string
  height?: number  // px
  style?: React.CSSProperties
}

export default function Waveform({ bars=12, active=true, color='#06B6D4', height=40, style }: WaveformProps) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:3, height, ...style }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} style={{
          flex:1, maxWidth:4, height:'100%', borderRadius:2,
          background: color,
          transformOrigin: 'bottom center',
          opacity: active ? 0.85 : 0.25,
          transform: active ? undefined : `scaleY(${0.15 + (i % 4) * 0.12})`,
          animation: active ? `wave 1.2s ease-in-out ${DELAYS[i % DELAYS.length]} infinite` : undefined,
        }} />
      ))}
    </div>
  )
}
