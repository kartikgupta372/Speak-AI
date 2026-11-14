'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Mic2, Square, RefreshCw, ChevronRight,
  Briefcase, Users, Megaphone, Monitor, Plus, Upload, X
} from 'lucide-react'
import Waveform from '@/components/Waveform'
import { toWav } from '@/lib/audio'
import { createAudioRecorder, stopStream } from '@/lib/recording'

// ── Constants ────────────────────────────────────────────────────────────────
const GOALS = [
  { id: 'interview',       icon: Briefcase, label: 'Job Interview',   desc: 'Confident and structured' },
  { id: 'presentation',    icon: Monitor,   label: 'Presentation',    desc: 'Engaging and clear' },
  { id: 'pitch',           icon: Megaphone, label: 'Pitch / Sales',   desc: 'Energetic and persuasive' },
  { id: 'public_speaking', icon: Users,     label: 'Public Speaking', desc: 'Commanding and warm' },
]

const STYLES = [
  { id: 'authoritative', label: 'Authoritative', sub: 'Commanding and decisive' },
  { id: 'warm',          label: 'Warm',          sub: 'Empathetic and connecting' },
  { id: 'energetic',     label: 'Energetic',     sub: 'Dynamic and enthusiastic' },
  { id: 'intellectual',  label: 'Intellectual',  sub: 'Precise and thoughtful' },
]

// Built-in speakers (fetched from backend; shown as quick-select)
const BUILTIN_SPEAKERS = [
  { label: 'Barack Obama',     hint: 'Measured, deliberate' },
  { label: 'Steve Jobs',       hint: 'High energy, story-driven' },
  { label: 'Shashi Tharoor',   hint: 'Fluid, intellectual' },
  { label: 'Winston Churchill', hint: 'Grave, rhythmic' },
  { label: 'Other / Custom',   hint: 'Upload your own samples' },
]

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''
const authH = (): Record<string, string> => API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}

// ── Component ────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)          // 1 goal · 2 style · 3 speaker · 4 record
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [goal, setGoal] = useState('')
  const [style, setStyle] = useState('')

  // Speaker state
  const [speakerChoice, setSpeakerChoice] = useState('')   // label of chosen speaker
  const [customName, setCustomName] = useState('')
  const [customCategory, setCustomCategory] = useState('custom')
  const [customSamples, setCustomSamples] = useState<File[]>([])
  const [uploadingCustom, setUploadingCustom] = useState(false)
  const [customSpeakerId, setCustomSpeakerId] = useState('')

  // Recording state
  const [recording, setRecording] = useState(false)
  const [recorded, setRecorded] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const mr = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  // ── Recording helpers ─────────────────────────────────────────────────────
  const startRec = async () => {
    setError('')
    try {
      const { recorder, stream } = await createAudioRecorder()
      mr.current = recorder
      chunks.current = []
      mr.current.ondataavailable = e => chunks.current.push(e.data)
      mr.current.onstop = () => {
        setAudioBlob(new Blob(chunks.current, { type: mr.current?.mimeType || 'audio/webm' }))
        setRecorded(true)
        stopStream(stream)
      }
      mr.current.start()
      setRecording(true)
      setSeconds(0)
      timer.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the microphone.')
    }
  }

  const stopRec = () => {
    mr.current?.stop()
    setRecording(false)
    if (timer.current) clearInterval(timer.current)
  }
  const retake = () => { setRecorded(false); setAudioBlob(null); setSeconds(0); setError('') }
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ── Custom speaker upload ─────────────────────────────────────────────────
  const handleSampleFiles = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files).slice(0, 5)
    setCustomSamples(prev => [...prev, ...arr].slice(0, 5))
  }

  const uploadCustomSpeaker = async (): Promise<string | null> => {
    if (!customName.trim()) { setError('Please enter the speaker name.'); return null }
    if (customSamples.length === 0) { setError('Upload at least 1 audio sample of this person.'); return null }
    setUploadingCustom(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('name', customName.trim())
      fd.append('description', `Custom speaker: ${customName}`)
      fd.append('category', customCategory || 'custom')
      for (const f of customSamples) fd.append('audio_samples', f)

      const res = await fetch(`${API}/speakers/custom`, {
        method: 'POST', headers: { Accept: 'application/json', ...authH() }, body: fd,
      })
      if (!res.ok) throw new Error((await res.json()).detail || 'Upload failed')
      const data = await res.json()
      setCustomSpeakerId(data.speaker_id)
      return data.speaker_id
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Custom speaker creation failed.')
      return null
    } finally {
      setUploadingCustom(false)
    }
  }

  // ── Main submit (baseline recording + onboarding) ────────────────────
  const submit = async () => {
    if (!audioBlob) return
    if (seconds < 5) { setError('Recording too short — speak for at least 5 seconds.'); return }
    setLoading(true)
    setError('')

    // Cycle through encouraging loading messages while waiting
    const MSGS = [
      'Analysing your voice…',
      'Extracting acoustic features…',
      'Matching to speaker profiles…',
      'Building your coaching profile…',
      'Almost there…',
    ]
    let msgIdx = 0
    const msgTimer = setInterval(() => {
      msgIdx = (msgIdx + 1) % MSGS.length
      // Directly update the button text node via a data attribute trick
      const el = document.getElementById('onboard-loading-msg')
      if (el) el.textContent = MSGS[msgIdx]
    }, 3500)

    const controller = new AbortController()
    const fetchTimeout = setTimeout(() => controller.abort(), 120_000) // 2 min hard cap

    try {
      // 1. If custom speaker, upload it first
      let resolvedSpeakerId = customSpeakerId
      if (speakerChoice === 'Other / Custom' && !resolvedSpeakerId) {
        const id = await uploadCustomSpeaker()
        if (!id) { clearInterval(msgTimer); clearTimeout(fetchTimeout); setLoading(false); return }
        resolvedSpeakerId = id
      }

      // 2. Onboard user
      const wav = await toWav(audioBlob)
      const goalLabel = GOALS.find(g => g.id === goal)?.label || goal
      const styleLabel = STYLES.find(s => s.id === style)?.label || style
      const fd = new FormData()
      fd.append('name', name || 'User')
      fd.append('email', email || `user_${Date.now()}@speak.demo`)
      fd.append('goals', `${goalLabel} — ${styleLabel} delivery`)
      fd.append('scenario', goalLabel)
      fd.append('preferred_language', 'en')
      fd.append('audio', wav, 'baseline.wav')

      const res = await fetch(`${API}/onboard`, {
        method: 'POST',
        headers: { Accept: 'application/json', ...authH() },
        body: fd,
        signal: controller.signal,
      })
      if (!res.ok) throw new Error((await res.json()).detail || `Server error ${res.status}`)
      const data = await res.json()

      // Store user info
      localStorage.setItem('speak_user_id', data.user_profile.user_id)
      localStorage.setItem('speak_user_name', name || 'User')
      if (data.matched_speakers?.length > 0) {
        localStorage.setItem('speak_top_match', JSON.stringify(data.matched_speakers[0]))
      }

      // 3. Resolve speaker_id for chat session
      let finalSpeakerId = resolvedSpeakerId
      if (!finalSpeakerId && speakerChoice && speakerChoice !== 'Other / Custom') {
        try {
          const spkRes = await fetch(`${API}/speakers`, { headers: { ...authH() } })
          const spkList = await spkRes.json()
          const lastName = speakerChoice.split(' ').pop()?.toLowerCase() || ''
          const match = spkList.find((s: { name: string; id: string }) =>
            s.name.toLowerCase().includes(lastName)
          )
          if (match) finalSpeakerId = match.id
        } catch { /* ignore */ }
      }

      // Fallback — use first matched speaker from onboarding
      if (!finalSpeakerId && data.matched_speakers?.length > 0) {
        finalSpeakerId = data.matched_speakers[0].speaker.id
      }

      // 4. Create chat session
      if (finalSpeakerId) {
        const sessRes = await fetch(`${API}/chat/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authH() },
          body: JSON.stringify({
            user_id: data.user_profile.user_id,
            speaker_id: finalSpeakerId,
            goal: GOALS.find(g => g.id === goal)?.label || 'public speaking',
            style: STYLES.find(s => s.id === style)?.label || 'confident',
          }),
        })
        if (sessRes.ok) {
          const sessData = await sessRes.json()
          router.push(`/chat/${sessData.id}`)
          return
        }
      }

      // Fallback to dashboard if chat session creation fails
      router.push('/dashboard')

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Onboarding failed.'
      if (msg.includes('abort') || msg.includes('AbortError')) {
        setError('Analysis is taking longer than expected. Make sure the backend is running, then try again.')
      } else {
        setError(msg.includes('fetch') ? 'Cannot reach the backend. Is it running on port 8000?' : msg)
      }
    } finally {
      clearInterval(msgTimer)
      clearTimeout(fetchTimeout)
      setLoading(false)
    }
  }

  const isCustom = speakerChoice === 'Other / Custom'

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 12,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    color: 'white', fontSize: 14, outline: 'none', fontFamily: 'Plus Jakarta Sans,sans-serif',
  }

  const totalSteps = 4
  const stepLabels = ['Choose goal', 'Pick style', 'Choose speaker', 'Record baseline']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, borderRadius: '50%', background: 'rgba(79,70,229,0.07)', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 500, position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Mic2 size={18} color="#06B6D4" />
            <span style={{ fontFamily: 'Syne,serif', fontWeight: 700, fontSize: 20, color: 'white' }}>SPEAK</span>
          </div>
        </div>

        <h1 style={{ fontFamily: 'Syne,serif', fontWeight: 700, fontSize: 26, color: 'white', textAlign: 'center', marginBottom: 6 }}>
          {step === 1 && 'What are you working toward?'}
          {step === 2 && 'What vocal style do you want?'}
          {step === 3 && 'Who do you want to speak like?'}
          {step === 4 && 'Record your baseline'}
        </h1>
        <p style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 13, marginBottom: 28 }}>
          {step === 1 && "Choose your context — we'll tailor the coaching accordingly."}
          {step === 2 && 'Pick the vocal identity you want to develop.'}
          {step === 3 && 'Select a well-known speaker or upload samples of anyone you choose.'}
          {step === 4 && 'Speak naturally for 30–60 seconds. No script needed.'}
        </p>

        {/* Progress bars */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(135deg,#06B6D4,#4F46E5)', width: step > i ? '100%' : '0%', transition: 'width 0.5s ease' }} />
            </div>
          ))}
        </div>

        <div className="glass-card" style={{ borderRadius: 24, padding: 28 }}>

          {/* ── Step 1: Goal ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {GOALS.map(({ id, icon: Icon, label, desc }) => (
                  <button key={id} onClick={() => setGoal(id)} style={{
                    padding: 14, borderRadius: 14, textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
                    border: goal === id ? '1px solid rgba(6,182,212,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    background: goal === id ? 'rgba(6,182,212,0.08)' : 'rgba(255,255,255,0.03)',
                  }}>
                    <Icon size={16} color={goal === id ? '#06B6D4' : 'var(--muted)'} style={{ marginBottom: 6 }} />
                    <div style={{ fontFamily: 'Syne,serif', fontWeight: 600, fontSize: 13, color: goal === id ? 'white' : 'rgba(255,255,255,0.8)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{desc}</div>
                  </button>
                ))}
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inp} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional)" style={inp} />
              </div>
            </div>
          )}

          {/* ── Step 2: Style ─────────────────────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STYLES.map(({ id, label, sub }) => (
                <button key={id} onClick={() => setStyle(id)} style={{
                  padding: 14, borderRadius: 14, textAlign: 'left', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: style === id ? '1px solid rgba(79,70,229,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  background: style === id ? 'rgba(79,70,229,0.08)' : 'rgba(255,255,255,0.03)',
                  transition: 'all 0.2s',
                }}>
                  <div>
                    <div style={{ fontFamily: 'Syne,serif', fontWeight: 600, color: style === id ? 'white' : 'rgba(255,255,255,0.8)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</div>
                  </div>
                  {style === id && <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg,#06B6D4,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', flexShrink: 0 }}>✓</div>}
                </button>
              ))}
            </div>
          )}

          {/* ── Step 3: Speaker ───────────────────────────────────────────── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {BUILTIN_SPEAKERS.map(({ label, hint }) => (
                <button key={label} onClick={() => { setSpeakerChoice(label); setError('') }} style={{
                  padding: 14, borderRadius: 14, textAlign: 'left', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: speakerChoice === label ? '1px solid rgba(6,182,212,0.45)' : '1px solid rgba(255,255,255,0.08)',
                  background: speakerChoice === label ? 'rgba(6,182,212,0.07)' : 'rgba(255,255,255,0.03)',
                  transition: 'all 0.2s',
                }}>
                  <div>
                    <div style={{ fontFamily: 'Syne,serif', fontWeight: 600, color: speakerChoice === label ? 'white' : 'rgba(255,255,255,0.8)', marginBottom: 2, fontSize: 14 }}>
                      {label === 'Other / Custom' ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} />{label}</span> : label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{hint}</div>
                  </div>
                  {speakerChoice === label && <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg,#06B6D4,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', flexShrink: 0 }}>✓</div>}
                </button>
              ))}

              {/* Custom speaker form */}
              {isCustom && (
                <div style={{ marginTop: 8, padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Speaker name (e.g. Elon Musk, Your Manager)" style={inp} />
                  <input value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="Category (e.g. tech, business, entertainment)" style={inp} />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                      Upload 1–5 audio clips of this person speaking (WAV/MP3, each ≤ 10 MB)
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} style={{
                      width: '100%', padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                      border: '1px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.02)',
                      color: 'var(--muted)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                      <Upload size={14} /> Click to upload audio samples
                    </button>
                    <input ref={fileInputRef} type="file" accept="audio/*" multiple style={{ display: 'none' }}
                      onChange={e => handleSampleFiles(e.target.files)} />
                    {customSamples.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {customSamples.map((f, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', padding: '4px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                            <span>🎵 {f.name}</span>
                            <button onClick={() => setCustomSamples(s => s.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}>
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: 12 }}>⚠ {error}</div>}
            </div>
          )}

          {/* ── Step 4: Record ───────────────────────────────────────────── */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <div style={{ width: '100%', height: 60, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '0 16px' }}>
                {recording ? <Waveform bars={24} active={true} color="#06B6D4" height={38} style={{ width: '100%' }} />
                 : recorded ? <Waveform bars={24} active={false} color="#06B6D4" height={38} style={{ width: '100%' }} />
                 : <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Waveform will appear here</span>}
              </div>

              <div style={{ fontFamily: 'Syne,serif', fontWeight: 800, fontSize: 36, color: recording ? '#06B6D4' : 'rgba(255,255,255,0.25)' }}>{fmt(seconds)}</div>

              {!recorded ? (
                <button onClick={recording ? stopRec : startRec} style={{
                  width: 80, height: 80, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                  background: recording ? 'rgba(239,68,68,0.8)' : 'linear-gradient(135deg,#06B6D4,#4F46E5)',
                  transition: 'all 0.3s', boxShadow: recording ? 'none' : '0 0 36px rgba(6,182,212,0.3)',
                }} className={recording ? 'record-pulse' : ''}>
                  {recording ? <Square size={26} color="white" fill="white" /> : <Mic2 size={30} color="white" />}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={retake} className="btn-ghost" style={{ padding: '10px 18px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <RefreshCw size={13} /> Retake
                  </button>
                  <button onClick={submit} disabled={loading} className="btn-primary" style={{ padding: '10px 22px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    {loading
                      ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><span id="onboard-loading-msg">Analysing your voice…</span></>
                      : <>{uploadingCustom ? 'Processing speaker…' : 'Start coaching'} <ChevronRight size={13} /></>}
                  </button>
                </div>
              )}

              {error && (
                <div style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: 12, lineHeight: 1.6 }}>
                  ⚠ {error}
                </div>
              )}

              <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6 }}>
                Speak for at least 30 seconds for the most accurate analysis.<br />
                Introduce yourself, give a pitch, read aloud — anything natural.
              </p>
            </div>
          )}

          {/* Next button */}
          {step < 4 && (
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setError(''); setStep(s => s + 1) }}
                disabled={
                  (step === 1 && !goal) ||
                  (step === 2 && !style) ||
                  (step === 3 && !speakerChoice) ||
                  (step === 3 && isCustom && (!customName.trim() || customSamples.length === 0))
                }
                className="btn-primary"
                style={{ padding: '11px 22px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                Continue <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
          Step {step} of {totalSteps} · {stepLabels[step - 1]}
        </p>
      </div>
    </div>
  )
}
