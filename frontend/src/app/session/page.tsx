'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Mic2, Square, RefreshCw, ChevronDown, X, Upload,
  Plus, Key, AlertTriangle, CheckCircle2, Loader2
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import Waveform from '@/components/Waveform'
import ScoreRing from '@/components/ScoreRing'
import { toWav } from '@/lib/audio'
import {
  createAudioRecorder, stopStream,
  checkMicPermission, requestMicPermission,
  type MicPermissionState,
} from '@/lib/recording'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Speaker {
  id: string
  name: string
  category?: string
  description?: string
  bio?: string
  key_characteristics?: Record<string, string>
  is_custom?: boolean
}

interface Result {
  confidence_score: number; clarity_score: number
  pacing_score: number; stress_accuracy: number
  feedback: string; session_duration_seconds: number
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''
const authH = (): Record<string, string> => API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}

const CATEGORY_LABELS: Record<string, string> = {
  political: 'Political Orator', tech: 'Tech Visionary',
  intellectual: 'Intellectual Orator', business: 'Business Leader',
  entertainment: 'Entertainment', science: 'Science Communicator',
  sports: 'Sports Figure', custom: 'Custom Speaker',
}

const FEEDBACK_SECTIONS = [
  { label: '✓  What you did well',    color: '#06B6D4', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.18)' },
  { label: '→  Biggest gap to close', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.18)' },
  { label: '◈  Drills for this week', color: '#818CF8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.18)' },
  { label: '★  Your next milestone',  color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
]

// ── Mic Permission Banner ──────────────────────────────────────────────────────
function MicPermissionBanner({
  state, onRequest,
}: { state: MicPermissionState; onRequest: () => void }) {
  if (state === 'granted' || state === 'unknown') return null

  if (state === 'denied') {
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px',
        borderRadius: 14, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)',
        marginBottom: 20,
      }}>
        <AlertTriangle size={16} color="#EF4444" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#FCA5A5', marginBottom: 4 }}>
            Microphone access blocked
          </div>
          <div style={{ fontSize: 12, color: 'rgba(252,165,165,0.8)', lineHeight: 1.6 }}>
            Click the <strong>🔒</strong> or <strong>🎙</strong> icon in your browser&apos;s address bar →
            <strong> Site settings</strong> → set Microphone to <strong>Allow</strong>, then reload the page.
          </div>
        </div>
      </div>
    )
  }

  if (state === 'prompt' || state === 'checking') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
        borderRadius: 14, background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.3)',
        marginBottom: 20, cursor: state === 'prompt' ? 'pointer' : 'default',
      }} onClick={state === 'prompt' ? onRequest : undefined}>
        {state === 'checking'
          ? <Loader2 size={16} color="#F59E0B" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
          : <Mic2 size={16} color="#F59E0B" style={{ flexShrink: 0 }} />}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#FCD34D', marginBottom: 2 }}>
            {state === 'checking' ? 'Checking microphone…' : 'Microphone permission needed'}
          </div>
          {state === 'prompt' && (
            <div style={{ fontSize: 12, color: 'rgba(252,211,77,0.8)' }}>
              Click here to allow microphone access before recording.
            </div>
          )}
        </div>
        {state === 'prompt' && (
          <button style={{
            marginLeft: 'auto', padding: '6px 14px', borderRadius: 9,
            background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)',
            color: '#FCD34D', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
          }}>
            Allow
          </button>
        )}
      </div>
    )
  }

  return null
}

// ── Add Custom Speaker Modal ───────────────────────────────────────────────────
function AddSpeakerModal({
  onClose,
  onCreated,
  userId,
}: {
  onClose: () => void
  onCreated: (speaker: Speaker) => void
  userId: string
}) {
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<'groq' | 'openai'>('groq')
  const [apiKey, setApiKey] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [step, setStep] = useState<'form' | 'loading' | 'done' | 'error'>('form')
  const [result, setResult] = useState<Speaker | null>(null)
  const [error, setError] = useState('')
  const [loadingMsg, setLoadingMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const addFiles = (fl: FileList | null) => {
    if (!fl) return
    setFiles(prev => [...prev, ...Array.from(fl)].slice(0, 5))
  }

  const submit = async () => {
    if (!name.trim()) { setError('Enter the speaker name.'); return }
    if (!apiKey.trim()) { setError('Enter your API key.'); return }
    if (files.length === 0) { setError('Upload at least 1 audio clip of this speaker.'); return }

    setStep('loading')
    setLoadingMsg('Fetching speaker profile via AI…')

    try {
      const fd = new FormData()
      fd.append('speaker_name', name.trim())
      fd.append('user_id', userId)
      fd.append('user_api_key', apiKey.trim())
      fd.append('api_provider', provider)
      for (const f of files) fd.append('audio_samples', f)

      setLoadingMsg('Processing audio samples…')
      const res = await fetch(`${API}/speakers/ai-custom`, {
        method: 'POST',
        headers: { Accept: 'application/json', ...authH() },
        body: fd,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Server error ${res.status}`)
      }

      const data = await res.json()
      const newSpeaker: Speaker = {
        id: data.speaker_id,
        name: data.name,
        category: data.category || 'custom',
        description: data.description,
        bio: data.bio,
        key_characteristics: data.key_characteristics,
        is_custom: true,
      }
      setResult(newSpeaker)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create speaker.')
      setStep('error')
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 11,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: 'white', fontSize: 14, outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(7,13,27,0.88)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 500,
        background: 'linear-gradient(180deg,#0C1428 0%,#070D1B 100%)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 28, padding: 32,
        position: 'relative', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8,
          cursor: 'pointer', padding: 6, display: 'flex', color: 'var(--muted)',
        }}><X size={16} /></button>

        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Loader2 size={40} color="#06B6D4" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
            <div style={{ fontFamily: 'Syne,serif', fontWeight: 600, color: 'white', fontSize: 18, marginBottom: 8 }}>
              Building speaker profile…
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{loadingMsg}</div>
          </div>
        )}

        {step === 'done' && result && (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle2 size={44} color="#4ADE80" style={{ margin: '0 auto 16px' }} />
            <div style={{ fontFamily: 'Syne,serif', fontWeight: 700, color: 'white', fontSize: 20, marginBottom: 6 }}>
              {result.name} added!
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
              {result.description}
            </div>
            {result.bio && (
              <div style={{
                borderRadius: 12, padding: '12px 16px', background: 'rgba(6,182,212,0.07)',
                border: '1px solid rgba(6,182,212,0.15)', color: 'var(--muted)',
                fontSize: 12, lineHeight: 1.7, marginBottom: 20, textAlign: 'left',
              }}>
                {result.bio}
              </div>
            )}
            {result.key_characteristics && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
                {Object.entries(result.key_characteristics).map(([k, v]) => (
                  <span key={k} style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 999,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--muted)', textTransform: 'capitalize',
                  }}>{k}: {v}</span>
                ))}
              </div>
            )}
            <button onClick={() => onCreated(result)} className="btn-primary" style={{
              padding: '12px 28px', borderRadius: 14, fontSize: 14, width: '100%',
            }}>
              Start practicing with {result.name.split(' ')[0]}
            </button>
          </div>
        )}

        {(step === 'form' || step === 'error') && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg,#06B6D4,#4F46E5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><Plus size={18} color="white" /></div>
                <div>
                  <div style={{ fontFamily: 'Syne,serif', fontWeight: 700, color: 'white', fontSize: 18 }}>
                    Add any speaker
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    AI-enriched profile + acoustic matching from your audio clips
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Speaker name */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  SPEAKER NAME
                </label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Elon Musk, Jensen Huang, Sam Altman" style={inp} />
              </div>

              {/* API Provider + Key */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  YOUR API KEY <span style={{ color: '#06B6D4' }}>(used once, never stored)</span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={provider} onChange={e => setProvider(e.target.value as 'groq' | 'openai')}
                    style={{ ...inp, width: 100, flexShrink: 0, cursor: 'pointer' }}>
                    <option value="groq">Groq</option>
                    <option value="openai">OpenAI</option>
                  </select>
                  <input
                    value={apiKey} onChange={e => setApiKey(e.target.value)}
                    placeholder={provider === 'groq' ? 'gsk_...' : 'sk-...'}
                    type="password" style={{ ...inp, flex: 1 }}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Key size={10} />
                  {provider === 'groq'
                    ? 'Get a free key at console.groq.com'
                    : 'Get a key at platform.openai.com'}
                  &nbsp;· Key is sent to your own account, not ours.
                </div>
              </div>

              {/* Audio upload */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  AUDIO SAMPLES <span style={{ fontWeight: 400 }}>(1–5 clips · WAV/MP3 · ≤10 MB each)</span>
                </label>
                <button onClick={() => fileRef.current?.click()} style={{
                  width: '100%', padding: '14px', borderRadius: 12, cursor: 'pointer',
                  border: '1px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.02)',
                  color: 'var(--muted)', fontSize: 13, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <Upload size={15} /> Click to upload audio clips
                </button>
                <input ref={fileRef} type="file" accept="audio/*" multiple style={{ display: 'none' }}
                  onChange={e => addFiles(e.target.files)} />

                {files.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {files.map((f, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontSize: 12, color: 'var(--muted)', padding: '6px 10px',
                        borderRadius: 8, background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}>
                        <span>🎵 {f.name} <span style={{ opacity: 0.5 }}>({(f.size / 1024 / 1024).toFixed(1)} MB)</span></span>
                        <button onClick={() => setFiles(s => s.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
                  Upload YouTube clips, podcast recordings, or any audio of them speaking.
                  More clips = better acoustic matching.
                </div>
              </div>

              {error && step === 'error' && (
                <div style={{
                  padding: '10px 14px', borderRadius: 11,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#FCA5A5', fontSize: 12, lineHeight: 1.6,
                }}>
                  ⚠ {error}
                </div>
              )}

              <button onClick={submit} className="btn-primary" style={{
                padding: '13px', borderRadius: 14, fontSize: 14, marginTop: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Plus size={15} /> Create speaker profile
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Session Page ──────────────────────────────────────────────────────────
export default function SessionPage() {
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [spkId, setSpkId] = useState('')
  const [ddOpen, setDdOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recorded, setRecorded] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [userId, setUserId] = useState('')
  const [micState, setMicState] = useState<MicPermissionState>('unknown')
  const [showAddSpeaker, setShowAddSpeaker] = useState(false)

  const mr = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Initialise ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const uid = localStorage.getItem('speak_user_id') || 'demo-user'
    setUserId(uid)
    loadSpeakers(uid)
    initMicPermission()
  }, [])

  const loadSpeakers = async (uid: string) => {
    try {
      const res = await fetch(`${API}/speakers?user_id=${uid}`, {
        headers: { Accept: 'application/json', ...authH() },
      })
      if (!res.ok) return
      const list: Speaker[] = await res.json()
      setSpeakers(list)
      if (list.length > 0) setSpkId(list[0].id)
    } catch { /* offline */ }
  }

  const initMicPermission = async () => {
    setMicState('checking')
    const state = await checkMicPermission()
    setMicState(state === 'unknown' ? 'unknown' : state)
  }

  const handleRequestMic = useCallback(async () => {
    setMicState('checking')
    const { granted, error: err } = await requestMicPermission()
    if (granted) {
      setMicState('granted')
      setError('')
    } else {
      setMicState('denied')
      if (err) setError(err)
    }
  }, [])

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  // ── Recording ───────────────────────────────────────────────────────────────
  const startRec = async () => {
    setError('')
    // If permission not yet granted, request it first
    if (micState === 'prompt') {
      await handleRequestMic()
    }
    try {
      const { recorder, stream } = await createAudioRecorder()
      // Permission was granted — update state
      setMicState('granted')
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
      const msg = err instanceof Error ? err.message : 'Could not start the microphone.'
      setError(msg)
      if (msg.toLowerCase().includes('block') || msg.toLowerCase().includes('denied')) {
        setMicState('denied')
      }
    }
  }

  const stopRec = () => {
    mr.current?.stop()
    setRecording(false)
    if (timer.current) clearInterval(timer.current)
  }

  const retake = () => {
    setRecorded(false); setAudioBlob(null)
    setResult(null); setSeconds(0); setError('')
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ── Analyse ─────────────────────────────────────────────────────────────────
  const analyse = async () => {
    if (!audioBlob) return
    if (!spkId) {
      setError('No speaker selected. Please select a target speaker.')
      return
    }
    setLoading(true); setError('')
    try {
      const wavBlob = await toWav(audioBlob)
      const fd = new FormData()
      fd.append('user_id', userId)
      fd.append('target_speaker_id', spkId)
      fd.append('audio', wavBlob, 'session.wav')

      const res = await fetch(`${API}/analyze-session`, {
        method: 'POST', headers: { Accept: 'application/json', ...authH() }, body: fd,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Server error ${res.status}`)
      }
      setResult(await res.json())
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed.'
      setError(msg.includes('fetch') ? 'Cannot reach the backend. Is it running on port 8000?' : msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSpeakerCreated = (spk: Speaker) => {
    setSpeakers(prev => [...prev, spk])
    setSpkId(spk.id)
    setShowAddSpeaker(false)
  }

  const sel = speakers.find(s => s.id === spkId)
  const catLabel = (spk: Speaker) =>
    CATEGORY_LABELS[spk.category || 'custom'] || (spk.is_custom ? 'Custom Speaker' : spk.category || '')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      {showAddSpeaker && (
        <AddSpeakerModal
          userId={userId}
          onClose={() => setShowAddSpeaker(false)}
          onCreated={handleSpeakerCreated}
        />
      )}

      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '128px 24px 80px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Syne,serif', fontWeight: 700, fontSize: 'clamp(28px,5vw,44px)', color: 'white' }}>Practice Session</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>Record, get scored, receive coaching — all in one take.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: 24, alignItems: 'start' }}>

          {/* ── Left: Recording ─────────────────────────────────────────────── */}
          <div className="glass-card" style={{ borderRadius: 28, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Mic permission banner */}
            <MicPermissionBanner state={micState} onRequest={handleRequestMic} />

            {/* Speaker selector */}
            <div>
              <label style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, display: 'block', marginBottom: 8 }}>
                Target Speaker
              </label>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setDdOpen(o => !o)} style={{
                  width: '100%', padding: '12px 16px', borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>
                      {sel ? sel.name : 'Select a speaker…'}
                    </div>
                    {sel && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{catLabel(sel)}</div>}
                  </div>
                  <ChevronDown size={15} color="var(--muted)"
                    style={{ transform: ddOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {ddOpen && (
                  <div className="glass-card" style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                    borderRadius: 14, overflow: 'hidden', zIndex: 10,
                    border: '1px solid rgba(255,255,255,0.1)', maxHeight: 360, overflowY: 'auto',
                  }}>
                    {speakers.length === 0 && (
                      <div style={{ padding: '14px 16px', color: 'var(--muted)', fontSize: 13 }}>
                        Loading speakers…
                      </div>
                    )}

                    {speakers.map(s => (
                      <button key={s.id} onClick={() => { setSpkId(s.id); setDdOpen(false) }} style={{
                        width: '100%', padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                        border: 'none', background: s.id === spkId ? 'rgba(6,182,212,0.08)' : 'transparent',
                        transition: 'background 0.15s', borderBottom: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'white' }}>
                            {s.name}
                            {s.is_custom && (
                              <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 6px', borderRadius: 999, background: 'rgba(79,70,229,0.2)', border: '1px solid rgba(79,70,229,0.3)', color: '#818CF8' }}>
                                CUSTOM
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{catLabel(s)}</div>
                        </div>
                        {s.id === spkId && (
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#06B6D4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 9, color: 'white' }}>✓</span>
                          </div>
                        )}
                      </button>
                    ))}

                    {/* Add custom speaker row */}
                    <button onClick={() => { setDdOpen(false); setShowAddSpeaker(true) }} style={{
                      width: '100%', padding: '13px 16px', cursor: 'pointer', textAlign: 'left',
                      border: 'none', background: 'rgba(79,70,229,0.05)',
                      borderTop: '1px solid rgba(255,255,255,0.06)', transition: 'background 0.15s',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: 'linear-gradient(135deg,#06B6D4,#4F46E5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Plus size={14} color="white" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Add any speaker…</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>Upload clips + your API key → AI-powered profile</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Waveform */}
            <div style={{ height: 80, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px', overflow: 'hidden' }}>
              {recording
                ? <Waveform bars={28} active={true}  color="#06B6D4" height={52} style={{ width: '100%' }} />
                : recorded
                ? <Waveform bars={28} active={false} color="#06B6D4" height={52} style={{ width: '100%' }} />
                : <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recording will appear here</span>}
            </div>

            {/* Timer */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Syne,serif', fontWeight: 800, fontSize: 52, color: recording ? '#06B6D4' : 'rgba(255,255,255,0.2)', letterSpacing: '-0.02em' }}>
                {fmt(seconds)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                {recording ? 'Recording… click stop when done'
                  : !recorded ? 'Press the mic to begin'
                  : `Recorded ${fmt(seconds)} — ready to analyse`}
              </div>
            </div>

            {/* Record button */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {!recorded ? (
                <button
                  onClick={recording ? stopRec : startRec}
                  disabled={micState === 'denied'}
                  className={recording ? 'record-pulse' : ''}
                  title={micState === 'denied' ? 'Microphone access blocked — see instructions above' : ''}
                  style={{
                    width: 96, height: 96, borderRadius: '50%', border: 'none',
                    cursor: micState === 'denied' ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                    background: micState === 'denied'
                      ? 'rgba(239,68,68,0.3)'
                      : recording
                      ? 'rgba(239,68,68,0.85)'
                      : 'linear-gradient(135deg,#06B6D4,#4F46E5)',
                    boxShadow: recording || micState === 'denied' ? 'none' : '0 0 48px rgba(6,182,212,0.35)',
                    transition: 'all 0.3s', opacity: micState === 'denied' ? 0.6 : 1,
                  }}>
                  {recording ? <Square size={30} color="white" fill="white" /> : <Mic2 size={36} color="white" />}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={retake} className="btn-ghost" style={{ padding: '12px 22px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <RefreshCw size={14} /> Retake
                  </button>
                  <button onClick={analyse} disabled={loading} className="btn-primary" style={{ padding: '12px 28px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    {loading
                      ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Analysing…</>
                      : 'Analyse session'}
                  </button>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: 12, lineHeight: 1.6 }}>
                ⚠ {error}
              </div>
            )}

            {/* Tips */}
            <div style={{ borderRadius: 14, padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(6,182,212,0.1)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
              <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Tips:</strong> Speak for at least 30 seconds.
              Introduce yourself, give a pitch, read aloud. We measure <em>how</em> you speak, not what you say.
            </div>
          </div>

          {/* ── Right: Results ───────────────────────────────────────────────── */}
          <div style={{ opacity: result ? 1 : 0.35, transform: result ? 'translateX(0)' : 'translateX(16px)', transition: 'all 0.5s ease', pointerEvents: result ? 'auto' : 'none' }}>
            {result ? (
              <div className="glass-card" style={{ borderRadius: 28, padding: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#06B6D4', animation: 'pulse 2s infinite' }} />
                  <span style={{ fontSize: 10, color: '#06B6D4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Analysis complete</span>
                </div>
                <div style={{ marginBottom: 28 }}>
                  <h3 style={{ fontFamily: 'Syne,serif', fontWeight: 600, color: 'white', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Session Scores</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                    <ScoreRing score={result.confidence_score} label="Confidence" size={76} />
                    <ScoreRing score={result.clarity_score}    label="Clarity"    size={76} color="#818CF8" />
                    <ScoreRing score={result.pacing_score}     label="Pacing"     size={76} color="#4ADE80" />
                    <ScoreRing score={result.stress_accuracy}  label="Stress"     size={76} color="#F59E0B" />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
                    Duration: {Math.round(result.session_duration_seconds)}s · vs {sel?.name}
                  </div>
                </div>
                <div>
                  <h3 style={{ fontFamily: 'Syne,serif', fontWeight: 600, color: 'white', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
                    Coaching Feedback
                  </h3>
                  {(() => {
                    const paras = result.feedback.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
                    if (paras.length >= 4) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {FEEDBACK_SECTIONS.map(({ label, color, bg, border }, i) => (
                            <div key={i} style={{ borderRadius: 14, padding: '14px 16px', background: bg, border: `1px solid ${border}` }}>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color, marginBottom: 8 }}>{label}</div>
                              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>{paras[i]}</p>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    return (
                      <div style={{ borderRadius: 14, padding: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{result.feedback}</p>
                      </div>
                    )
                  })()}
                </div>
              </div>
            ) : (
              <div className="glass-card" style={{ borderRadius: 28, padding: 32, minHeight: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Mic2 size={26} color="var(--muted)" />
                </div>
                <h3 style={{ fontFamily: 'Syne,serif', fontWeight: 600, color: 'white', marginBottom: 8 }}>Results appear here</h3>
                <p style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 260, lineHeight: 1.6 }}>
                  Record a session and hit <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Analyse session</strong> to see scores and AI coaching feedback.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
