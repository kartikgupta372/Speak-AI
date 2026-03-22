'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Mic2 } from 'lucide-react'

const links = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/session', label: 'Practice' },
  { href: '/settings', label: 'Settings' },
]

export default function Navbar() {
  const path = usePathname()
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
