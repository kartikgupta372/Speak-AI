import Link from 'next/link'
import { ArrowRight, Play, Mic2, BarChart2, TrendingUp, Zap, Target, Activity, Volume2 } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Waveform from '@/components/Waveform'

const SPEAKERS = [
  { name:'Barack Obama',     cat:'Political Orator',    tags:['Measured pace','Warm authority','Deliberate pauses'], init:'BO', grad:'linear-gradient(135deg,#1d4ed8,#1e3a8a)' },
  { name:'Steve Jobs',       cat:'Tech Visionary',      tags:['High energy','Storytelling','Minimal clarity'],       init:'SJ', grad:'linear-gradient(135deg,#0891b2,#0c4a6e)' },
  { name:'Shashi Tharoor',   cat:'Intellectual Orator', tags:['Rich vocabulary','Fluid eloquence','Deep resonance'], init:'ST', grad:'linear-gradient(135deg,#7c3aed,#2e1065)' },
  { name:'Winston Churchill', cat:'Wartime Leader',     tags:['Gravitas','Powerful rhythm','Urgent energy'],         init:'WC', grad:'linear-gradient(135deg,#b45309,#451a03)' },
]

const STEPS = [
  { icon:Mic2,       n:'01', title:'Record',  desc:'Speak freely for 30–60 s. We capture pitch, pace, pauses and energy from every syllable.' },
  { icon:BarChart2,  n:'02', title:'Analyze', desc:'AI maps your voice to a 384-dim embedding space and finds your match among iconic speakers.' },
  { icon:TrendingUp, n:'03', title:'Improve', desc:'Get a blueprint, session scores, and concrete drills that close the gap to your target style.' },
]

const METRICS = [
  { icon:Activity, name:'Pitch',   desc:'Fundamental frequency and variation.',    color:'#06B6D4' },
  { icon:Zap,      name:'Energy',  desc:'Vocal power and presence.',               color:'#818CF8' },
  { icon:Target,   name:'Pace',    desc:'Syllable rate that engages and resonates.',color:'#4ADE80' },
  { icon:Volume2,  name:'Pausing', desc:'Strategic silence — a great speaker\'s tool.', color:'#F59E0B' },
  { icon:BarChart2,name:'Clarity', desc:'Articulation that makes every word land.', color:'#F472B6' },
]

export default function Home() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', overflowX:'hidden' }}>
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'128px 24px 80px', position:'relative' }}>
        {/* Glow orbs */}
        <div style={{ position:'absolute', top:'25%', left:'20%', width:400, height:400, borderRadius:'50%', background:'rgba(79,70,229,0.08)', filter:'blur(80px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:'35%', right:'20%', width:320, height:320, borderRadius:'50%', background:'rgba(6,182,212,0.08)', filter:'blur(80px)', pointerEvents:'none' }} />

        <div style={{ maxWidth:800, margin:'0 auto', textAlign:'center', position:'relative' }}>
          {/* Badge */}
          <div className="glass-card" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 16px', borderRadius:999, border:'1px solid rgba(6,182,212,0.25)', color:'#06B6D4', fontSize:13, fontWeight:600, marginBottom:32 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#06B6D4', animation:'pulse 2s infinite' }} />
            AI-Powered Voice Coaching
          </div>

          <h1 style={{ fontFamily:'Syne,serif', fontSize:'clamp(52px,8vw,88px)', fontWeight:800, lineHeight:1, letterSpacing:'-0.02em', color:'white', marginBottom:24 }}>
            Speak with<br />
            <span className="gradient-text">confidence.</span>
          </h1>

          <p style={{ fontSize:18, color:'var(--muted)', maxWidth:560, margin:'0 auto 40px', lineHeight:1.7 }}>
            Analyze your voice, match iconic speakers like Obama and Steve Jobs, and get a
            personalized coaching plan to transform your delivery — not just your content.
          </p>

          <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap', marginBottom:64 }}>
            <Link href="/onboarding" className="btn-primary" style={{ padding:'16px 32px', borderRadius:16, fontSize:16, display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
              Start your free voice analysis <ArrowRight size={16} />
            </Link>
            <button className="btn-ghost" style={{ padding:'16px 32px', borderRadius:16, fontSize:16, display:'flex', alignItems:'center', gap:8 }}>
              <Play size={16} /> Watch demo
            </button>
          </div>

          {/* Hero visual card */}
          <div className="glass-card" style={{ display:'inline-flex', alignItems:'center', gap:24, padding:'20px 28px', borderRadius:20, border:'1px solid rgba(6,182,212,0.15)' }}>
            <div>
              <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Live analysis</div>
              <Waveform bars={20} active={true} color="#06B6D4" height={40} style={{ width:160 }} />
            </div>
            <div style={{ borderLeft:'1px solid rgba(255,255,255,0.08)', paddingLeft:24 }}>
              {[['Pace','3.2 syl/s','#06B6D4'],['Energy','72/100','#818CF8'],['Pitch','148 Hz','#4ADE80']].map(([l,v,c]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', gap:32, marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'var(--muted)' }}>{l}</span>
                  <span style={{ fontSize:12, fontWeight:700, color: c as string }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ borderLeft:'1px solid rgba(255,255,255,0.08)', paddingLeft:24, textAlign:'center' }}>
              <div style={{ fontSize:10, color:'var(--muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.1em' }}>Closest match</div>
              <div style={{ width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg,#1d4ed8,#1e3a8a)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 4px', fontFamily:'Syne,serif', fontWeight:700, color:'rgba(255,255,255,0.4)', fontSize:14 }}>BO</div>
              <div style={{ fontSize:13, fontWeight:600, color:'white' }}>B. Obama</div>
              <div style={{ fontSize:11, color:'#06B6D4', fontWeight:700 }}>74% match</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section style={{ padding:'96px 24px', maxWidth:1152, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <p style={{ color:'#06B6D4', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:12 }}>The process</p>
          <h2 style={{ fontFamily:'Syne,serif', fontSize:'clamp(32px,5vw,48px)', fontWeight:700, color:'white' }}>Three steps to a better voice</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:24 }}>
          {STEPS.map(({ icon:Icon, n, title, desc }) => (
            <div key={n} className="glass-card" style={{ borderRadius:24, padding:32, transition:'transform 0.2s,border-color 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform='translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.borderColor='rgba(6,182,212,0.2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform='none'; (e.currentTarget as HTMLDivElement).style.borderColor='rgba(255,255,255,0.08)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
                <div style={{ width:48, height:48, borderRadius:12, background:'linear-gradient(135deg,#06B6D4,#4F46E5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon size={22} color="white" />
                </div>
                <span style={{ fontFamily:'Syne,serif', fontSize:40, fontWeight:800, color:'rgba(255,255,255,0.04)' }}>{n}</span>
              </div>
              <h3 style={{ fontFamily:'Syne,serif', fontSize:20, fontWeight:700, color:'white', marginBottom:12 }}>{title}</h3>
              <p style={{ fontSize:14, color:'var(--muted)', lineHeight:1.7 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SPEAKERS ─────────────────────────────────────────── */}
      <section style={{ padding:'96px 24px', background:'rgba(79,70,229,0.03)' }}>
        <div style={{ maxWidth:1152, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <p style={{ color:'#06B6D4', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:12 }}>Your mentors</p>
            <h2 style={{ fontFamily:'Syne,serif', fontSize:'clamp(32px,5vw,48px)', fontWeight:700, color:'white' }}>Iconic voices. Real data.</h2>
            <p style={{ color:'var(--muted)', marginTop:12, maxWidth:480, margin:'12px auto 0' }}>Each speaker's style is encoded in our voice embedding space. Discover which one you're closest to.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:20 }}>
            {SPEAKERS.map(sp => (
              <div key={sp.name} className="glass-card" style={{ borderRadius:24, padding:24, transition:'transform 0.3s,border-color 0.3s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform='translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.borderColor='rgba(255,255,255,0.15)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform='none'; (e.currentTarget as HTMLDivElement).style.borderColor='rgba(255,255,255,0.08)' }}>
                <div style={{ height:100, borderRadius:16, background:sp.grad, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                  <span style={{ fontFamily:'Syne,serif', fontWeight:800, fontSize:36, color:'rgba(255,255,255,0.25)' }}>{sp.init}</span>
                </div>
                <div style={{ fontFamily:'Syne,serif', fontWeight:700, color:'white', fontSize:16, marginBottom:2 }}>{sp.name}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:12 }}>{sp.cat}</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {sp.tags.map(t => (
                    <span key={t} style={{ fontSize:11, padding:'3px 10px', borderRadius:999, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'var(--muted)' }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT WE MEASURE ──────────────────────────────────── */}
      <section style={{ padding:'96px 24px', maxWidth:1152, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <p style={{ color:'#06B6D4', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:12 }}>The science</p>
          <h2 style={{ fontFamily:'Syne,serif', fontSize:'clamp(32px,5vw,48px)', fontWeight:700, color:'white' }}>We measure what matters</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16 }}>
          {METRICS.map(({ icon:Icon, name, desc, color }) => (
            <div key={name} className="glass-card" style={{ borderRadius:20, padding:24 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:`${color}20`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                <Icon size={18} color={color} />
              </div>
              <div style={{ fontFamily:'Syne,serif', fontWeight:700, color:'white', marginBottom:8 }}>{name}</div>
              <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────── */}
      <section style={{ padding:'0 24px 96px' }}>
        <div className="glass-card" style={{ maxWidth:720, margin:'0 auto', borderRadius:32, padding:'80px 48px', textAlign:'center', border:'1px solid rgba(6,182,212,0.12)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(79,70,229,0.04),rgba(6,182,212,0.04))' }} />
          <div style={{ position:'absolute', bottom:0, left:0, right:0, opacity:0.1 }}>
            <Waveform bars={36} active={true} color="#06B6D4" height={32} style={{ width:'100%' }} />
          </div>
          <div style={{ position:'relative' }}>
            <h2 style={{ fontFamily:'Syne,serif', fontSize:'clamp(28px,5vw,44px)', fontWeight:700, color:'white', marginBottom:16 }}>Your voice journey starts here.</h2>
            <p style={{ color:'var(--muted)', marginBottom:32, fontSize:17 }}>Record 60 seconds. See your vocal profile. Get matched to a mentor.</p>
            <Link href="/onboarding" className="btn-primary" style={{ padding:'16px 40px', borderRadius:16, fontSize:16, display:'inline-flex', alignItems:'center', gap:8, textDecoration:'none' }}>
              Analyse my voice — it&apos;s free <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop:'1px solid rgba(255,255,255,0.05)', padding:'24px', textAlign:'center' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, color:'var(--muted)', fontSize:13 }}>
          <Mic2 size={14} color="#06B6D4" />
          <span style={{ fontFamily:'Syne,serif', fontWeight:600, color:'white' }}>SPEAK</span>
          <span>— AI Speech Coaching · © 2025</span>
        </div>
      </footer>
    </div>
  )
}
