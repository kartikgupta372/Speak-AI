'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Mic2, TrendingUp, Clock, ChevronRight, BarChart2, Award, ArrowUpRight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Navbar from '@/components/Navbar'
import Waveform from '@/components/Waveform'
import { getUserProgress } from '@/lib/api'
import type { ProgressResp, SessionResp, SpeakerMatch } from '@/lib/api'

const FALLBACK_MATCH: SpeakerMatch = {
  speaker: {
    id: '', name: 'Barack Obama', category: 'political', language: 'en',
    key_characteristics: { pace: 'measured', tone: 'warm', energy: 'controlled' },
  },
  similarity: 0.74,
  match_reason: "Complete onboarding to see your real speaker match.",
}

const SPEAKER_INIT: Record<string, { init: string; grad: string }> = {
  'Barack Obama':     { init: 'BO', grad: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)' },
  'Steve Jobs':       { init: 'SJ', grad: 'linear-gradient(135deg,#0891b2,#0c4a6e)' },
  'Shashi Tharoor':   { init: 'ST', grad: 'linear-gradient(135deg,#7c3aed,#2e1065)' },
  'Winston Churchill':{ init: 'WC', grad: 'linear-gradient(135deg,#b45309,#451a03)' },
}

const SPEAKER_ID_MAP: Record<string, string> = {
  'Barack Obama': 'obama', 'Steve Jobs': 'jobs',
  'Shashi Tharoor': 'tharoor', 'Winston Churchill': 'churchill',
}

function fmt(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const TooltipStyle = {
  contentStyle: { background: '#0C1428', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#E8EEFF', fontSize: 12 },
  cursor: { stroke: 'rgba(255,255,255,0.06)' },
}

export default function DashboardPage() {
  const [progress, setProgress] = useState<ProgressResp | null>(null)
  const [userName, setUserName] = useState('there')
  const [topMatch, setTopMatch] = useState<SpeakerMatch>(FALLBACK_MATCH)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const uid = localStorage.getItem('speak_user_id')
    const uname = localStorage.getItem('speak_user_name')
    if (uname) setUserName(uname.split(' ')[0])

    // Load real speaker match from onboarding result
    const stored = localStorage.getItem('speak_top_match')
    if (stored) {
      try { setTopMatch(JSON.parse(stored)) } catch { /* ignore */ }
    }

    if (!uid) { setLoading(false); return }

    getUserProgress(uid)
      .then(d => { setProgress(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const sessions = progress?.sessions || []
  const chartData = sessions.slice(-10).map((s: SessionResp, i: number) => ({
    s: `S${i + 1}`,
    confidence: Math.round(s.confidence_score),
    pacing: Math.round(s.pacing_score),
    clarity: Math.round(s.clarity_score),
  }))
  const latest = sessions[sessions.length - 1]

  const spkName = topMatch.speaker.name
  const { init = '?', grad = 'linear-gradient(135deg,#1d4ed8,#1e3a8a)' } = SPEAKER_INIT[spkName] || {}
  const spkSlug = SPEAKER_ID_MAP[spkName] || 'obama'
  const spkTags = Object.values(topMatch.speaker.key_characteristics || {}).slice(0, 3)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '128px 24px 80px' }}>

        {/* ── Welcome ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 4 }}>Welcome back</p>
          <h1 style={{ fontFamily: 'Syne,serif', fontWeight: 700, fontSize: 'clamp(32px,5vw,48px)', color: 'white', lineHeight: 1.1 }}>
            {userName}<span style={{ background: 'linear-gradient(135deg,#06B6D4,#818CF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>.</span>
          </h1>
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            {progress?.improvement_trend === 'improving' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', color: '#06B6D4', fontSize: 13, fontWeight: 600 }}>
                <TrendingUp size={14} /> Scores are trending up — keep going!
              </div>
            )}
            {latest && (
              <div className="glass-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999, fontSize: 13, color: 'var(--muted)' }}>
                <Clock size={13} /> Last session: {fmt(latest.session_date)} · Confidence {Math.round(latest.confidence_score)}
              </div>
            )}
          </div>
        </div>

        {/* ── Top row ───────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 24, marginBottom: 24 }}>

          {/* Matched speaker — real data from localStorage */}
          <div className="glass-card" style={{ borderRadius: 24, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>Your matched speaker</p>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#06B6D4', background: 'rgba(6,182,212,0.1)', padding: '4px 10px', borderRadius: 999 }}>
                {Math.round(topMatch.similarity * 100)}% match
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: 'Syne,serif', fontWeight: 800, fontSize: 22, color: 'rgba(255,255,255,0.35)' }}>{init}</span>
              </div>
              <div>
                <div style={{ fontFamily: 'Syne,serif', fontWeight: 700, color: 'white', fontSize: 18, marginBottom: 2 }}>{spkName}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, textTransform: 'capitalize' }}>{topMatch.speaker.category}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {spkTags.map(t => (
                    <span key={t} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--muted)', textTransform: 'capitalize' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14, marginBottom: 14 }}>
              {topMatch.match_reason}
            </p>
            <Link href={`/speaker/${spkSlug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#06B6D4', textDecoration: 'none', fontWeight: 600 }}>
              View profile <ArrowUpRight size={12} />
            </Link>
          </div>

          {/* Record CTA */}
          <div className="glass-card" style={{ borderRadius: 24, padding: 28, border: '1px solid rgba(6,182,212,0.12)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.12 }}>
              <Waveform bars={30} active={true} color="#06B6D4" height={28} style={{ width: '100%' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#06B6D4,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 0 32px rgba(6,182,212,0.3)' }}>
                <Mic2 size={22} color="white" />
              </div>
              <h3 style={{ fontFamily: 'Syne,serif', fontWeight: 700, color: 'white', fontSize: 22, marginBottom: 10 }}>Record a practice session</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
                Keep building toward {spkName.split(' ').pop()}&apos;s delivery style. Each session sharpens the gap.
              </p>
            </div>
            <Link href="/session" className="btn-primary" style={{ marginTop: 24, padding: '12px 24px', borderRadius: 14, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', width: 'fit-content', position: 'relative' }}>
              Start session <ChevronRight size={15} />
            </Link>
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────────── */}
        {progress && progress.total_sessions > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Sessions', value: String(progress.total_sessions), icon: BarChart2, color: '#06B6D4' },
              { label: 'Avg Confidence', value: String(Math.round(progress.avg_confidence)), icon: Award, color: '#818CF8' },
              { label: 'Avg Clarity',    value: String(Math.round(progress.avg_clarity)),    icon: TrendingUp, color: '#4ADE80' },
              { label: 'Avg Pacing',     value: String(Math.round(progress.avg_pacing)),     icon: Clock, color: '#F59E0B' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="glass-card" style={{ borderRadius: 20, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{label}</span>
                  <Icon size={15} color={color} />
                </div>
                <div style={{ fontFamily: 'Syne,serif', fontWeight: 700, fontSize: 36, color: 'white' }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Charts ────────────────────────────────────────────── */}
        {chartData.length > 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 20, marginBottom: 24 }}>
            {[
              { key: 'confidence', label: 'Confidence Over Time', color: '#06B6D4' },
              { key: 'pacing',     label: 'Pacing Score Over Time', color: '#818CF8' },
            ].map(({ key, label, color }) => (
              <div key={key} className="glass-card" style={{ borderRadius: 20, padding: 24 }}>
                <h3 style={{ fontFamily: 'Syne,serif', fontWeight: 600, color: 'white', fontSize: 14, marginBottom: 20 }}>{label}</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="s" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip {...TooltipStyle} />
                    <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2}
                      dot={{ fill: color, r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: color }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        )}

        {/* ── Session history ───────────────────────────────────── */}
        {sessions.length > 0 ? (
          <div className="glass-card" style={{ borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'Syne,serif', fontWeight: 600, color: 'white', fontSize: 15 }}>Session History</h3>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{progress?.total_sessions} sessions</span>
            </div>
            {[...sessions].reverse().slice(0, 8).map((s, i) => (
              <div key={s.id || i}
                style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(6,182,212,0.5)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>{fmt(s.session_date)}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.session_duration_seconds ? `${Math.round(s.session_duration_seconds)}s` : '—'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 24 }}>
                  {[['Conf', s.confidence_score], ['Pace', s.pacing_score], ['Clarity', s.clarity_score]].map(([l, v]) => (
                    <div key={l as string} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{l}</div>
                      <div style={{ fontFamily: 'Syne,serif', fontWeight: 700, fontSize: 15, color: (v as number) >= 80 ? '#06B6D4' : (v as number) >= 60 ? '#818CF8' : '#F59E0B' }}>
                        {Math.round(v as number)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : !loading ? (
          <div className="glass-card" style={{ borderRadius: 20, padding: 80, textAlign: 'center' }}>
            <Mic2 size={36} color="var(--muted)" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontFamily: 'Syne,serif', fontWeight: 600, color: 'white', marginBottom: 8 }}>No sessions yet</h3>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>Record your first practice session to start tracking progress.</p>
            <Link href="/session" className="btn-primary" style={{ padding: '12px 24px', borderRadius: 14, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              Record first session <ChevronRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="glass-card" style={{ borderRadius: 20, padding: 80, textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '2px solid rgba(6,182,212,0.3)', borderTopColor: '#06B6D4', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        )}
      </div>
    </div>
  )
}
