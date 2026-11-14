'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Save, RefreshCw, Download } from 'lucide-react'
import Navbar from '@/components/Navbar'

const GOALS = [
  { id: 'interview',       label: 'Job Interviews' },
  { id: 'presentation',    label: 'Presentations' },
  { id: 'pitch',           label: 'Pitching / Sales' },
  { id: 'public_speaking', label: 'Public Speaking' },
]
const SPEAKERS = [
  { id: 'obama',     label: 'Barack Obama' },
  { id: 'jobs',      label: 'Steve Jobs' },
  { id: 'tharoor',   label: 'Shashi Tharoor' },
  { id: 'churchill', label: 'Winston Churchill' },
]

export default function SettingsPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [goals, setGoals] = useState<string[]>([])
  const [speaker, setSpeaker] = useState('obama')
  const [saved, setSaved] = useState(false)

  useEffect(() => { setName(localStorage.getItem('speak_user_name') || '') }, [])

  const toggle = (id: string) => setGoals(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id])

  const save = () => {
    localStorage.setItem('speak_user_name', name)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: 14,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    color: 'white', fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '128px 24px 80px' }}>

        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontFamily: 'Syne,serif', fontWeight: 700, fontSize: 40, color: 'white', marginBottom: 6 }}>Settings</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Manage your profile and coaching preferences.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Profile */}
          <div className="glass-card" style={{ borderRadius: 24, padding: 28 }}>
            <h2 style={{ fontFamily: 'Syne,serif', fontWeight: 700, color: 'white', fontSize: 17, marginBottom: 20 }}>Profile</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, display: 'block', marginBottom: 8 }}>Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(6,182,212,0.4)'}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)'} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, display: 'block', marginBottom: 8 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" style={inputStyle}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(6,182,212,0.4)'}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)'} />
              </div>
            </div>
          </div>

          {/* Goals */}
          <div className="glass-card" style={{ borderRadius: 24, padding: 28 }}>
            <h2 style={{ fontFamily: 'Syne,serif', fontWeight: 700, color: 'white', fontSize: 17, marginBottom: 20 }}>Coaching Goals</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {GOALS.map(({ id, label }) => (
                <button key={id} onClick={() => toggle(id)} style={{
                  padding: '12px 16px', borderRadius: 14, textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  border: goals.includes(id) ? '1px solid rgba(6,182,212,0.45)' : '1px solid rgba(255,255,255,0.08)',
                  background: goals.includes(id) ? 'rgba(6,182,212,0.08)' : 'rgba(255,255,255,0.03)',
                  color: goals.includes(id) ? 'white' : 'var(--muted)', transition: 'all 0.2s',
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Preferred speaker */}
          <div className="glass-card" style={{ borderRadius: 24, padding: 28 }}>
            <h2 style={{ fontFamily: 'Syne,serif', fontWeight: 700, color: 'white', fontSize: 17, marginBottom: 20 }}>Preferred Target Speaker</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SPEAKERS.map(({ id, label }) => (
                <button key={id} onClick={() => setSpeaker(id)} style={{
                  padding: '14px 16px', borderRadius: 14, textAlign: 'left', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: speaker === id ? '1px solid rgba(79,70,229,0.45)' : '1px solid rgba(255,255,255,0.08)',
                  background: speaker === id ? 'rgba(79,70,229,0.08)' : 'rgba(255,255,255,0.03)',
                  color: speaker === id ? 'white' : 'var(--muted)', fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
                }}>
                  {label}
                  {speaker === id && <span style={{ fontSize: 11, fontWeight: 700, color: '#818CF8' }}>Selected</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Account actions */}
          <div className="glass-card" style={{ borderRadius: 24, padding: 28 }}>
            <h2 style={{ fontFamily: 'Syne,serif', fontWeight: 700, color: 'white', fontSize: 17, marginBottom: 16 }}>Account Actions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: RefreshCw, label: 'Reset baseline analysis', href: '/onboarding' },
                { icon: Download,  label: 'Export my data',          href: null },
              ].map(({ icon: Icon, label, href }) =>
                href ? (
                  <Link key={label} href={href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'var(--muted)', fontSize: 13, textDecoration: 'none', transition: 'all 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.16)'; (e.currentTarget as HTMLAnchorElement).style.color = 'white' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--muted)' }}>
                    <Icon size={14} /> {label}
                  </Link>
                ) : (
                  <button key={label} onClick={() => alert('Export feature coming soon.')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.16)'; (e.currentTarget as HTMLButtonElement).style.color = 'white' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)' }}>
                    <Icon size={14} /> {label}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Save */}
          <button onClick={save} className="btn-primary" style={{ padding: '16px', borderRadius: 16, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
            {saved ? <>✓  Saved!</> : <><Save size={15} /> Save changes</>}
          </button>
        </div>
      </div>
    </div>
  )
}
