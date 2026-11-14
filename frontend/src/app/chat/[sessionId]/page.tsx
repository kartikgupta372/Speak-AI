'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Mic2, Square, Volume2, VolumeX, Plus, ChevronLeft, Trophy, RefreshCw } from 'lucide-react'
import Waveform from '@/components/Waveform'
import ScoreRing from '@/components/ScoreRing'
import { toWav } from '@/lib/audio'
import { createAudioRecorder, stopStream } from '@/lib/recording'
import { speak, stopSpeaking, ttsAvailable, preloadVoices } from '@/lib/tts'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''
const H = () => ({ Accept: 'application/json', ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}) })

// ── Types ──────────────────────────────────────────────────────────────────
interface Turn {
  id: string
  role: 'user' | 'coach'
  text: string
  tts_text?: string
  scores?: { confidence_score: number; clarity_score: number; pacing_score: number; stress_accuracy: number; overall: number }
  duration?: number
  milestone?: boolean
  milestoneMsg?: string
  progressPct?: number
  turnCount?: number
}

interface Session {
  id: string; speaker_name: string; goal: string; style: string
  best_score: number; turn_count: number; created_at: string
}

// ── Score bar sub-component ────────────────────────────────────────────────
function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
        <span style={{ color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{Math.round(value)}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: color, width: `${value}%`, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ChatPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<Session | null>(null)
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [turns, setTurns] = useState<Turn[]>([])
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [speakingTurnId, setSpeakingTurnId] = useState<string | null>(null)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [graduated, setGraduated] = useState(false)
  const [seconds, setSeconds] = useState(0)

  const mr = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const userId = typeof window !== 'undefined' ? localStorage.getItem('speak_user_id') || '' : ''

  // ── Load session data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return
    preloadVoices()

    // Load current session info
    fetch(`${API}/chat/sessions/${userId}`, { headers: H() })
      .then(r => r.json())
      .then((list: Session[]) => {
        setAllSessions(list)
        const s = list.find(x => x.id === sessionId)
        if (s) setSession(s)
      }).catch(() => {})

    // Welcome message
    setTurns([{
      id: 'welcome',
      role: 'coach',
      text: "Welcome to your coaching session! I'll analyze your voice on each recording and give you specific feedback to match your target speaker. Press the mic button whenever you're ready to speak.",
      tts_text: "Welcome! Press the mic button whenever you're ready to speak.",
    }])
  }, [sessionId, userId])

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  // ── Auto-play TTS on new coach message ───────────────────────────────────
  useEffect(() => {
    if (!ttsEnabled || turns.length === 0) return
    const last = turns[turns.length - 1]
    if (last.role === 'coach' && last.tts_text && last.id !== 'welcome') {
      setSpeakingTurnId(last.id)
      speak(last.tts_text, session?.speaker_name || '', () => setSpeakingTurnId(null))
    }
  }, [turns, ttsEnabled, session?.speaker_name])

  // ── Recording ────────────────────────────────────────────────────────────
  const startRec = async () => {
    try {
      const { recorder, stream } = await createAudioRecorder()
      mr.current = recorder
      chunks.current = []
      mr.current.ondataavailable = e => chunks.current.push(e.data)
      mr.current.onstop = () => {
        handleAudio(new Blob(chunks.current, { type: mr.current?.mimeType || 'audio/webm' }))
        stopStream(stream)
      }
      mr.current.start()
      setRecording(true)
      setSeconds(0)
      timer.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start the microphone.'
      setTurns(p => [...p, { id: `mic-${Date.now()}`, role: 'coach', text: msg }])
    }
  }

  const stopRec = () => {
    mr.current?.stop()
    setRecording(false)
    if (timer.current) clearInterval(timer.current)
  }

  const handleAudio = async (blob: Blob) => {
    setLoading(true)
    stopSpeaking()

    // Add user turn immediately
    const userTurnId = `user-${Date.now()}`
    setTurns(p => [...p, {
      id: userTurnId, role: 'user',
      text: `🎙 Recorded ${seconds}s`,
      duration: seconds,
    }])

    try {
      const wav = await toWav(blob)
      const fd = new FormData()
      fd.append('session_id', sessionId)
      fd.append('user_id', userId)
      fd.append('audio', wav, 'turn.wav')

      const res = await fetch(`${API}/chat/message`, { method: 'POST', headers: H(), body: fd })
      if (!res.ok) throw new Error((await res.json()).detail || 'Analysis failed')

      const data = await res.json()
      const coachTurnId = `coach-${Date.now()}`

      setTurns(p => [...p, {
        id: coachTurnId,
        role: 'coach',
        text: data.feedback_text,
        tts_text: data.tts_text,
        scores: data.scores,
        milestone: data.milestone_reached,
        milestoneMsg: data.milestone_message,
        progressPct: data.progress_pct,
        turnCount: data.turn_count,
      }])

      // Update session stats
      setSession(s => s ? { ...s, turn_count: data.turn_count, best_score: Math.max(s.best_score, data.scores.overall) } : s)

      if (data.milestone_reached) setGraduated(true)

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setTurns(p => [...p, { id: `err-${Date.now()}`, role: 'coach', text: `⚠ ${msg}` }])
    } finally {
      setLoading(false)
      setSeconds(0)
    }
  }

  const newChat = () => router.push('/onboarding')

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div style={{
        width: sidebarOpen ? 260 : 0, flexShrink: 0, overflow: 'hidden',
        background: 'rgba(12,20,40,0.95)', borderRight: '1px solid rgba(255,255,255,0.06)',
        transition: 'width 0.25s ease', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 16px', flexShrink: 0 }}>
          <button onClick={newChat} className="btn-primary" style={{
            width: '100%', padding: '10px 16px', borderRadius: 12, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
          }}>
            <Plus size={14} /> New Chat
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {allSessions.map(s => (
            <button key={s.id} onClick={() => { router.push(`/chat/${s.id}`); setSidebarOpen(false) }} style={{
              width: '100%', padding: '10px 12px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
              background: s.id === sessionId ? 'rgba(6,182,212,0.1)' : 'transparent',
              border: s.id === sessionId ? '1px solid rgba(6,182,212,0.2)' : '1px solid transparent',
              marginBottom: 4,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2 }}>{s.speaker_name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.goal} · {s.turn_count} turns</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          background: 'rgba(7,13,27,0.9)', backdropFilter: 'blur(12px)',
        }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            {sidebarOpen ? <ChevronLeft size={18} color="var(--muted)" /> : <Mic2 size={18} color="#06B6D4" />}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Syne,serif', fontWeight: 700, color: 'white', fontSize: 16 }}>
              {session ? `${session.speaker_name} · ${session.goal}` : 'Speech Coach'}
            </div>
            {session && (
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {session.turn_count} turns · Best {Math.round(session.best_score)}/100
              </div>
            )}
          </div>
          {/* TTS toggle */}
          <button onClick={() => { setTtsEnabled(e => !e); stopSpeaking() }} style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
            padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            color: ttsEnabled ? '#06B6D4' : 'var(--muted)', fontSize: 12,
          }}>
            {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {ttsEnabled ? 'Voice On' : 'Voice Off'}
          </button>
          <button onClick={newChat} style={{
            background: 'linear-gradient(135deg,#06B6D4,#4F46E5)', border: 'none', borderRadius: 10,
            padding: '8px 16px', cursor: 'pointer', color: 'white', fontSize: 13,
            fontFamily: 'Syne,serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Plus size={13} /> New Chat
          </button>
        </div>

        {/* Graduation banner */}
        {graduated && (
          <div style={{
            padding: '16px 24px', background: 'linear-gradient(135deg,rgba(6,182,212,0.15),rgba(79,70,229,0.15))',
            borderBottom: '1px solid rgba(6,182,212,0.2)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          }}>
            <Trophy size={20} color="#06B6D4" />
            <div>
              <div style={{ fontFamily: 'Syne,serif', fontWeight: 700, color: 'white', fontSize: 14 }}>
                90% Accuracy Reached! 🎉
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                You've mastered this style. Start a new chat to set a new challenge.
              </div>
            </div>
            <button onClick={newChat} className="btn-primary" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, marginLeft: 'auto' }}>
              Next Challenge
            </button>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {turns.map(turn => (
            <div key={turn.id} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: turn.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%', alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              {/* Milestone badge */}
              {turn.milestone && (
                <div style={{ marginBottom: 8, padding: '8px 14px', borderRadius: 12, background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)', fontSize: 12, color: '#06B6D4', fontWeight: 600 }}>
                  🏆 {turn.milestoneMsg}
                </div>
              )}

              {/* Message bubble */}
              <div style={{
                padding: '14px 16px', borderRadius: turn.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: turn.role === 'user' ? 'rgba(79,70,229,0.15)' : 'rgba(255,255,255,0.05)',
                border: turn.role === 'user' ? '1px solid rgba(79,70,229,0.25)' : '1px solid rgba(255,255,255,0.08)',
                width: '100%',
              }}>
                {/* User turn: waveform + duration */}
                {turn.role === 'user' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Waveform bars={16} active={false} color="#818CF8" height={28} style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>{turn.duration}s</span>
                  </div>
                )}

                {/* Coach turn: feedback text */}
                {turn.role === 'coach' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: turn.tts_text ? 8 : 0 }}>
                      <p style={{ fontSize: 14, color: '#E8EEFF', lineHeight: 1.7, margin: 0 }}>{turn.text}</p>
                      {turn.tts_text && (
                        <button onClick={() => {
                          if (speakingTurnId === turn.id) { stopSpeaking(); setSpeakingTurnId(null) }
                          else { setSpeakingTurnId(turn.id); speak(turn.tts_text!, session?.speaker_name || '', () => setSpeakingTurnId(null)) }
                        }} style={{
                          background: speakingTurnId === turn.id ? 'rgba(6,182,212,0.15)' : 'none',
                          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 8px',
                          cursor: 'pointer', flexShrink: 0,
                          color: speakingTurnId === turn.id ? '#06B6D4' : 'var(--muted)',
                        }}>
                          {speakingTurnId === turn.id
                            ? <VolumeX size={13} />
                            : <Volume2 size={13} />}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Scores block (below coach message) */}
              {turn.scores && (
                <div style={{ marginTop: 8, width: '100%', padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {/* Overall ring + progress */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                    <ScoreRing score={turn.scores.overall} label="Overall" size={64} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: 'var(--muted)' }}>Progress to 90%</span>
                        <span style={{ color: '#06B6D4', fontWeight: 700 }}>{turn.progressPct?.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#06B6D4,#4F46E5)', width: `${turn.progressPct}%`, transition: 'width 1s ease' }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Turn {turn.turnCount}</div>
                    </div>
                  </div>
                  {/* Individual score bars */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <ScoreBar label="Confidence" value={turn.scores.confidence_score} color="#06B6D4" />
                    <ScoreBar label="Clarity"    value={turn.scores.clarity_score}    color="#818CF8" />
                    <ScoreBar label="Pacing"     value={turn.scores.pacing_score}     color="#4ADE80" />
                    <ScoreBar label="Stress"     value={turn.scores.stress_accuracy}  color="#F59E0B" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div style={{ alignSelf: 'flex-start', padding: '12px 16px', borderRadius: '18px 18px 18px 4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 6, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#06B6D4', animation: `wave 1s ease-in-out ${i * 0.15}s infinite`, transformOrigin: 'center' }} />
              ))}
              <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>Analysing…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Recording input bar ──────────────────────────────────────────── */}
        <div style={{
          padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(7,13,27,0.9)', backdropFilter: 'blur(12px)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, maxWidth: 700, margin: '0 auto' }}>
            {/* Timer */}
            <div style={{ fontFamily: 'Syne,serif', fontWeight: 700, fontSize: 18, color: recording ? '#06B6D4' : 'rgba(255,255,255,0.2)', minWidth: 56 }}>
              {fmt(seconds)}
            </div>

            {/* Waveform when recording */}
            <div style={{ flex: 1, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {recording
                ? <Waveform bars={24} active={true} color="#06B6D4" height={36} style={{ width: '100%' }} />
                : <div style={{ height: 1, width: '100%', background: 'rgba(255,255,255,0.06)' }} />}
            </div>

            {/* Record / Stop button */}
            <button
              onClick={recording ? stopRec : startRec}
              disabled={loading || graduated}
              className={recording ? 'record-pulse' : ''}
              style={{
                width: 56, height: 56, borderRadius: '50%', border: 'none',
                cursor: loading || graduated ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', flexShrink: 0,
                background: recording ? 'rgba(239,68,68,0.85)' : loading || graduated ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#06B6D4,#4F46E5)',
                boxShadow: recording ? 'none' : '0 0 32px rgba(6,182,212,0.3)',
                transition: 'all 0.2s',
                opacity: loading ? 0.5 : 1,
              }}>
              {recording ? <Square size={20} color="white" fill="white" /> : <Mic2 size={22} color="white" />}
            </button>
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
            {graduated
              ? 'You reached 90% accuracy! Start a new chat for a new challenge.'
              : recording
              ? 'Recording… press stop when done'
              : 'Press the mic to record your next attempt'}
          </p>
        </div>
      </div>
    </div>
  )
}
