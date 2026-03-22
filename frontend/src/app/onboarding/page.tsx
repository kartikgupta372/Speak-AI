'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mic2, Square, RefreshCw, ChevronRight, Briefcase, Users, Megaphone, Presentation } from 'lucide-react'
import Waveform from '@/components/Waveform'

const GOALS = [
  { id:'interview',      icon:Briefcase,    label:'Job Interview',    desc:'Confident, structured' },
  { id:'presentation',   icon:Presentation, label:'Presentation',     desc:'Engaging, clear' },
  { id:'pitch',          icon:Megaphone,    label:'Pitch / Sales',    desc:'Energetic, persuasive' },
  { id:'public_speaking',icon:Users,        label:'Public Speaking',  desc:'Commanding, warm' },
]
const STYLES = [
  { id:'authoritative', label:'Authoritative', sub:'Commanding and decisive' },
  { id:'warm',          label:'Warm',          sub:'Empathetic and connecting' },
  { id:'energetic',     label:'Energetic',     sub:'Dynamic and enthusiastic' },
  { id:'intellectual',  label:'Intellectual',  sub:'Precise and thoughtful' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [goal, setGoal] = useState('')
  const [style, setStyle] = useState('')
  const [recording, setRecording] = useState(false)
  const [recorded, setRecorded] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob|null>(null)
  const [loading, setLoading] = useState(false)
  const mr = useRef<MediaRecorder|null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<ReturnType<typeof setInterval>|null>(null)

  useEffect(() => () => { if(timer.current) clearInterval(timer.current) }, [])

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mr.current = new MediaRecorder(stream)
      chunks.current = []
      mr.current.ondataavailable = e => chunks.current.push(e.data)
      mr.current.onstop = () => {
        setAudioBlob(new Blob(chunks.current, { type:'audio/webm' }))
        setRecorded(true)
        stream.getTracks().forEach(t => t.stop())
      }
      mr.current.start()
      setRecording(true)
      setSeconds(0)
      timer.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch { alert('Microphone permission required.') }
  }

  const stopRec = () => { mr.current?.stop(); setRecording(false); if(timer.current) clearInterval(timer.current) }
  const retake = () => { setRecorded(false); setAudioBlob(null); setSeconds(0) }
  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  const submit = async () => {
    if (!audioBlob) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('name', 'Demo User')
      fd.append('email', `user_${Date.now()}@speak.demo`)
      fd.append('goals', GOALS.find(g=>g.id===goal)?.label || goal)
      fd.append('scenario', goal)
      fd.append('preferred_language', 'en')
      fd.append('audio', audioBlob, 'baseline.webm')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL||'http://localhost:8000/api/v1'}/onboard`, { method:'POST', body:fd })
      const data = await res.json()
      localStorage.setItem('speak_user_id', data.user_profile.user_id)
      localStorage.setItem('speak_user_name', data.user_profile.name)
      router.push('/dashboard')
    } catch { alert('Onboarding failed — make sure the backend is running on port 8000.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'64px 24px', position:'relative' }}>
      <div style={{ position:'absolute', top:'30%', left:'50%', transform:'translateX(-50%)', width:600, height:400, borderRadius:'50%', background:'rgba(79,70,229,0.07)', filter:'blur(80px)', pointerEvents:'none' }} />

      <div style={{ width:'100%', maxWidth:480, position:'relative' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            <Mic2 size={18} color="#06B6D4" />
            <span style={{ fontFamily:'Syne,serif', fontWeight:700, fontSize:20, color:'white' }}>SPEAK</span>
          </div>
        </div>

        {/* Title */}
        <h1 style={{ fontFamily:'Syne,serif', fontWeight:700, fontSize:28, color:'white', textAlign:'center', marginBottom:8 }}>
          {step===1 && 'What are you working toward?'}
          {step===2 && 'What style do you want?'}
          {step===3 && 'Record your baseline'}
        </h1>
        <p style={{ color:'var(--muted)', textAlign:'center', fontSize:14, marginBottom:32 }}>
          {step===1 && "Choose your primary context — we'll tailor your speaker match."}
          {step===2 && 'Pick the vocal identity you want to develop.'}
          {step===3 && 'Speak naturally for 30–60 seconds. No scripts needed.'}
        </p>

        {/* Progress */}
        <div style={{ display:'flex', gap:8, marginBottom:32 }}>
          {[1,2,3].map(n => (
            <div key={n} style={{ flex:1, height:3, borderRadius:2, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
              <div style={{ height:'100%', background:'linear-gradient(135deg,#06B6D4,#4F46E5)', width: step >= n ? '100%' : '0%', transition:'width 0.5s ease' }} />
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="glass-card" style={{ borderRadius:24, padding:32 }}>

          {/* Step 1 */}
          {step===1 && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {GOALS.map(({ id, icon:Icon, label, desc }) => (
                <button key={id} onClick={() => setGoal(id)} style={{
                  padding:16, borderRadius:16, textAlign:'left', cursor:'pointer', transition:'all 0.2s',
                  border: goal===id ? '1px solid rgba(6,182,212,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  background: goal===id ? 'rgba(6,182,212,0.08)' : 'rgba(255,255,255,0.03)',
                }}>
                  <Icon size={18} color={goal===id ? '#06B6D4' : 'var(--muted)'} style={{ marginBottom:8 }} />
                  <div style={{ fontFamily:'Syne,serif', fontWeight:600, fontSize:13, color: goal===id ? 'white' : 'rgba(255,255,255,0.8)', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2 */}
          {step===2 && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {STYLES.map(({ id, label, sub }) => (
                <button key={id} onClick={() => setStyle(id)} style={{
                  padding:16, borderRadius:16, textAlign:'left', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between',
                  border: style===id ? '1px solid rgba(79,70,229,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  background: style===id ? 'rgba(79,70,229,0.08)' : 'rgba(255,255,255,0.03)',
                  transition:'all 0.2s',
                }}>
                  <div>
                    <div style={{ fontFamily:'Syne,serif', fontWeight:600, color: style===id ? 'white' : 'rgba(255,255,255,0.8)', marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:12, color:'var(--muted)' }}>{sub}</div>
                  </div>
                  {style===id && <div style={{ width:20, height:20, borderRadius:'50%', background:'linear-gradient(135deg,#06B6D4,#4F46E5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'white', flexShrink:0 }}>✓</div>}
                </button>
              ))}
            </div>
          )}

          {/* Step 3 */}
          {step===3 && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
              <div style={{ width:'100%', height:64, borderRadius:16, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:'0 16px' }}>
                {recording ? <Waveform bars={24} active={true} color="#06B6D4" height={40} style={{ width:'100%' }} /> :
                 recorded ? <Waveform bars={24} active={false} color="#06B6D4" height={40} style={{ width:'100%' }} /> :
                 <span style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Waveform will appear here</span>}
              </div>
              <div style={{ fontFamily:'Syne,serif', fontWeight:800, fontSize:40, color: recording ? '#06B6D4' : 'rgba(255,255,255,0.25)' }}>{fmt(seconds)}</div>
              {!recorded ? (
                <button onClick={recording ? stopRec : startRec} style={{
                  width:88, height:88, borderRadius:'50%', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', position:'relative',
                  background: recording ? 'rgba(239,68,68,0.8)' : 'linear-gradient(135deg,#06B6D4,#4F46E5)',
                  transition:'all 0.3s', boxShadow: recording ? 'none' : '0 0 40px rgba(6,182,212,0.3)',
                }} className={recording ? 'record-pulse' : ''}>
                  {recording ? <Square size={28} color="white" fill="white" /> : <Mic2 size={32} color="white" />}
                </button>
              ) : (
                <div style={{ display:'flex', gap:12 }}>
                  <button onClick={retake} className="btn-ghost" style={{ padding:'10px 20px', borderRadius:12, display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
                    <RefreshCw size={14} /> Retake
                  </button>
                  <button onClick={submit} disabled={loading} className="btn-primary" style={{ padding:'10px 24px', borderRadius:12, display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
                    {loading ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} /> Analysing…</> : <>Analyse my voice <ChevronRight size={14} /></>}
                  </button>
                </div>
              )}
              <p style={{ fontSize:11, color:'var(--muted)', textAlign:'center', lineHeight:1.6 }}>
                Speak for at least 30 seconds for accurate analysis.<br />
                Introduce yourself, a pitch, a quote — anything natural.
              </p>
            </div>
          )}

          {/* Next button */}
          {step < 3 && (
            <div style={{ marginTop:24, display:'flex', justifyContent:'flex-end' }}>
              <button onClick={() => setStep(s => s+1)} disabled={(step===1 && !goal)||(step===2 && !style)} className="btn-primary" style={{ padding:'12px 24px', borderRadius:12, display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
                Continue <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
        <p style={{ textAlign:'center', fontSize:11, color:'var(--muted)', marginTop:12 }}>
          Step {step} of 3 · {['Choose goal','Pick style','Record baseline'][step-1]}
        </p>
      </div>
    </div>
  )
}
