'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Mic2 } from 'lucide-react'

const links = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/session', label: 'Practice' },
  { href: '/settings', label: 'Settings' },
]

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:8000'

export default function Navbar() {
  const path = usePathname()
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    const check = () =>
      fetch(`${API_BASE}/health`)
        .then(r => setOnline(r.ok))
        .catch(() => setOnline(false))

    check()
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:50, padding:'16px 24px' }}>
      <div className="glass-card" style={{
        maxWidth:1152, margin:'0 auto', borderRadius:16,
        padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between'
      }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <div style={{
            width:32, height:32, borderRadius:8,
            background:'linear-gradient(135deg,#06B6D4,#4F46E5)',
            display:'flex', alignItems:'center', justifyContent:'center'
          }}>
            <Mic2 size={16} color="white" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily:'Syne,serif', fontWeight:700, fontSize:18, color:'white' }}>SPEAK</span>
          {/* Backend status dot */}
          {online !== null && (
            <span title={online ? 'Backend online' : 'Backend offline — start the server on port 8000'} style={{
              width: 7, height: 7, borderRadius: '50%', marginLeft: 2,
              background: online ? '#4ADE80' : '#EF4444',
              display: 'inline-block',
            }} />
          )}
        </Link>

        <div style={{ display:'flex', gap:4 }}>
          {links.map(({ href, label }) => (
            <Link key={href} href={href} style={{
              padding:'8px 16px', borderRadius:12,
              fontSize:14, fontWeight:500, textDecoration:'none',
              color: path === href ? 'white' : 'var(--muted)',
              background: path === href ? 'rgba(255,255,255,0.08)' : 'transparent',
              transition:'all 0.2s',
            }}>
              {label}
            </Link>
          ))}
        </div>

        <Link href="/onboarding" className="btn-primary" style={{ padding:'10px 20px', borderRadius:12, fontSize:14, textDecoration:'none' }}>
          Get Started
        </Link>
      </div>
    </nav>
  )
}
