/**
 * api.ts — All backend API calls in one place.
 * Automatically attaches Authorization header when NEXT_PUBLIC_API_KEY is set.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

function authHeaders(): Record<string, string> {
  const key = process.env.NEXT_PUBLIC_API_KEY
  if (key) return { Authorization: `Bearer ${key}` }
  return {}
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: {
        Accept: 'application/json',
        ...authHeaders(),
        ...opts?.headers,
      },
      ...opts,
    })
  } catch {
    throw new Error(
      `Cannot reach the backend at ${BASE}. Make sure the server is running on port 8000.`
    )
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface Speaker {
  id: string; name: string; description?: string; category?: string
  nationality?: string; language: string; image_url?: string; bio?: string
  key_characteristics?: Record<string, string>
}
export interface SpeakerMatch { speaker: Speaker; similarity: number; match_reason: string }
export interface UserProfile {
  user_id: string; name: string; email: string
  pitch_avg?: number; pace_syllables_per_sec?: number; energy_level?: number
  preferred_speaker_id?: string; onboarding_goals?: Record<string, unknown>
}
export interface OnboardingResp {
  user_profile: UserProfile; matched_speakers: SpeakerMatch[]
  baseline_metrics: Record<string, unknown>; intent: Record<string, unknown>
}
export interface SessionResp {
  id?: string; user_id: string; speaker_id?: string; session_date?: string
  confidence_score: number; clarity_score: number; pacing_score: number
  stress_accuracy: number; feedback: string; session_duration_seconds: number
  acoustic_features?: Record<string, unknown>
}
export interface ProgressResp {
  sessions: SessionResp[]; total_sessions: number
  avg_confidence: number; avg_clarity: number; avg_pacing: number
  improvement_trend: string
}

// ── Multipart fetch helper ─────────────────────────────────────────────────
async function formReq<T>(path: string, body: FormData): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', ...authHeaders() },
      body,
    })
  } catch {
    throw new Error(
      `Cannot reach the backend at ${BASE}. Make sure the server is running on port 8000.`
    )
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Health check ───────────────────────────────────────────────────────────
export const checkHealth = () =>
  fetch(`${BASE.replace('/api/v1', '')}/health`).then(r => r.json()).catch(() => null)

// ── API functions ──────────────────────────────────────────────────────────
export const getSpeakers = (p?: { language?: string; category?: string }) =>
  req<Speaker[]>(`/speakers${p ? '?' + new URLSearchParams(p as Record<string, string>) : ''}`)

export const getSpeaker      = (id: string) => req<Speaker>(`/speakers/${id}`)
export const onboardUser     = (fd: FormData) => formReq<OnboardingResp>('/onboard', fd)
export const analyzeSession  = (fd: FormData) => formReq<SessionResp>('/analyze-session', fd)
export const getUserProgress = (uid: string) => req<ProgressResp>(`/user-progress/${uid}`)
export const generateBlueprint = (p: {
  user_id: string; target_speaker_id: string; goals?: string; scenario?: string
}) =>
  req<{ user_id: string; target_speaker: string; blueprint: Record<string, unknown> }>(
    '/generate-blueprint',
    { method: 'POST', body: JSON.stringify(p), headers: { 'Content-Type': 'application/json' } }
  )
