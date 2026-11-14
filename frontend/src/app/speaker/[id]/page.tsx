'use client'
import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Waveform from '@/components/Waveform'

const DATA: Record<string, {
  name: string; cat: string; nat: string; init: string; grad: string
  bio: string; traits: Record<string, string>
  pitch: number; pace: number; energy: number; silence: number
  habits: string[]; matchNote: string
}> = {
  obama: {
    name: 'Barack Obama', cat: 'Political Orator', nat: 'American', init: 'BO',
    grad: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)',
    bio: "Former 44th President of the United States, widely regarded as one of the most gifted orators of the modern era. Obama's speeches blend personal narrative with soaring rhetoric, delivered with a calm command that builds to moments of genuine emotional power.",
    traits: { pace: 'measured', tone: 'warm', energy: 'controlled', pausing: 'deliberate' },
    pitch: 55, pace: 62, energy: 58, silence: 72,
    habits: [
      'Use deliberate 1–2 second pauses after key statements to let them land.',
      'Lower your pitch slightly and slow to ~2.8 syl/sec when making your most important point.',
      "Build sentences with three-part structures — the 'rule of three' creates rhythm.",
      'Vary your energy: calm baseline punctuated by brief peaks of intensity.',
      'End major sections with a falling cadence — it signals confidence, not questioning.',
    ],
    matchNote: "Your measured syllable rate and tendency toward deliberate pausing are the closest acoustic match to Obama's delivery. His controlled energy envelope also mirrors your baseline.",
  },
  jobs: {
    name: 'Steve Jobs', cat: 'Tech Visionary', nat: 'American', init: 'SJ',
    grad: 'linear-gradient(135deg,#0891b2,#0c4a6e)',
    bio: "Co-founder of Apple Inc., whose product presentations became legendary for their narrative structure, minimalist clarity, and infectious enthusiasm. Jobs proved that technology could be announced like theatre.",
    traits: { pace: 'dynamic', tone: 'enthusiastic', energy: 'high', pausing: 'theatrical' },
    pitch: 70, pace: 78, energy: 85, silence: 55,
    habits: [
      'Open with a hook — a single striking sentence before any context.',
      "Use short, declarative sentences. Never explain what you can demonstrate.",
      "Insert dramatic pauses before a reveal — the 'one more thing' technique.",
      'Vary pace aggressively: rush the setup, slow down for the punchline.',
      'End with a vision statement, not a feature list.',
    ],
    matchNote: "Your higher vocal energy and enthusiasm spikes match Jobs' characteristic bursts of excitement, while your underlying clarity of diction aligns with his precise articulation style.",
  },
  tharoor: {
    name: 'Shashi Tharoor', cat: 'Intellectual Orator', nat: 'Indian', init: 'ST',
    grad: 'linear-gradient(135deg,#7c3aed,#2e1065)',
    bio: "Indian politician, diplomat and author renowned for his extraordinary command of the English language. Tharoor's oratory is characterised by an extensive vocabulary, fluid delivery, and intellectual depth.",
    traits: { pace: 'fluid', tone: 'rich', energy: 'intellectual', vocabulary: 'expansive' },
    pitch: 65, pace: 70, energy: 62, silence: 48,
    habits: [
      'Expand your vocabulary actively — precision of word choice elevates credibility.',
      'Use subordinate clauses to layer complexity without losing the thread.',
      "Maintain consistent forward momentum — don't trail off at sentence ends.",
      'Deploy rhetorical questions to bring the audience into your reasoning.',
      'Let your genuine intellectual passion show — authenticity is the most persuasive tool.',
    ],
    matchNote: "Your steady pace and vocal consistency resemble Tharoor's flowing, uninterrupted delivery. His pitch range and resonance profile is the closest match to your fundamental frequency.",
  },
  churchill: {
    name: 'Winston Churchill', cat: 'Wartime Leader', nat: 'British', init: 'WC',
    grad: 'linear-gradient(135deg,#b45309,#451a03)',
    bio: "British Prime Minister during WWII whose radio addresses galvanised a nation under siege. Churchill's oratory is dense with imagery, rhythm, and an almost musical sense of cadence that turns political speech into literature.",
    traits: { pace: 'deliberate', tone: 'grave', energy: 'building', rhythm: 'poetic' },
    pitch: 48, pace: 52, energy: 70, silence: 80,
    habits: [
      'Build speeches like music: quiet opening, crescendo to a climax, resolving close.',
      "Use repetition for emphasis — 'We shall fight on the beaches' is a template.",
      'Choose Anglo-Saxon words over Latin ones for emotional impact.',
      'Project from your chest, not your throat — gravitas lives in the lower register.',
      "Never rush a big line. The longer the audience waits, the harder it lands.",
    ],
    matchNote: "Your lower pitch baseline and deliberate pacing closely align with Churchill's measured, grave delivery style. Your silence ratio also mirrors his use of strategic pausing for dramatic effect.",
  },
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value}/100</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, background: color, width: `${value}%`, transition: 'width 1s ease' }} />
      </div>
    </div>
  )
}

export default function SpeakerPage({ params }: { params: { id: string } }) {
  const sp = DATA[params.id] || DATA.obama

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '128px 24px 80px' }}>

        {/* Back */}
        <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13, textDecoration: 'none', marginBottom: 32, transition: 'color 0.2s' }}
          onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = 'white'}
          onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = 'var(--muted)'}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <div style={{ borderRadius: 28, background: sp.grad, border: '1px solid rgba(255,255,255,0.08)', padding: '48px 40px', marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.1 }}>
            <Waveform bars={44} active={true} color="white" height={28} style={{ width: '100%' }} />
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'Syne,serif', fontWeight: 800, fontSize: 28, color: 'rgba(255,255,255,0.5)' }}>{sp.init}</span>
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: 4 }}>{sp.cat}</p>
              <h1 style={{ fontFamily: 'Syne,serif', fontWeight: 700, fontSize: 'clamp(28px,5vw,44px)', color: 'white', marginBottom: 4 }}>{sp.name}</h1>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{sp.nat} · EN</p>
            </div>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.8, marginTop: 24, maxWidth: 640, position: 'relative' }}>{sp.bio}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>

          {/* ── Style stats ──────────────────────────────────────── */}
          <div className="glass-card" style={{ borderRadius: 24, padding: 28 }}>
            <h2 style={{ fontFamily: 'Syne,serif', fontWeight: 700, color: 'white', fontSize: 18, marginBottom: 24 }}>Voice Style Profile</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Meter label="Pitch range"        value={sp.pitch}   color="#06B6D4" />
              <Meter label="Speaking pace"      value={sp.pace}    color="#818CF8" />
              <Meter label="Vocal energy"       value={sp.energy}  color="#4ADE80" />
              <Meter label="Deliberate pausing" value={sp.silence} color="#F59E0B" />
            </div>
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 12 }}>Style Keywords</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.values(sp.traits).map(v => (
                  <span key={v} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--muted)', textTransform: 'capitalize' }}>{v}</span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Match reason + habits ─────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="glass-card" style={{ borderRadius: 24, padding: 24, border: '1px solid rgba(6,182,212,0.1)' }}>
              <h2 style={{ fontFamily: 'Syne,serif', fontWeight: 700, color: 'white', fontSize: 16, marginBottom: 12 }}>Why you match this speaker</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 }}>{sp.matchNote}</p>
            </div>
            <div className="glass-card" style={{ borderRadius: 24, padding: 24 }}>
              <h2 style={{ fontFamily: 'Syne,serif', fontWeight: 700, color: 'white', fontSize: 16, marginBottom: 16 }}>Key habits to learn</h2>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {sp.habits.map((h, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#06B6D4,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'white', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                      {i + 1}
                    </div>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <div className="glass-card" style={{ borderRadius: 24, padding: 32, marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(79,70,229,0.12)', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <h3 style={{ fontFamily: 'Syne,serif', fontWeight: 700, color: 'white', fontSize: 18, marginBottom: 6 }}>
              Practice as {sp.name.split(' ').pop()}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Record a session and get scored against this speaker's voice profile.</p>
          </div>
          <Link href="/session" className="btn-primary" style={{ padding: '14px 28px', borderRadius: 14, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
            Start session <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
