/**
 * tts.ts — Browser Text-to-Speech wrapper
 *
 * Uses the Web Speech API (SpeechSynthesis) — built into all modern browsers,
 * no API key required. Voice parameters are tuned per speaker to approximate
 * their delivery style. Gender-neutral: all speakers available to everyone.
 */

export interface SpeakerVoiceProfile {
  rate: number    // speaking rate (0.5 – 2.0, 1 = normal)
  pitch: number   // voice pitch (0 – 2.0, 1 = normal)
  volume: number  // volume (0 – 1.0)
}

// Acoustic style profiles per known speaker (gender-neutral parameters)
const SPEAKER_PROFILES: Record<string, SpeakerVoiceProfile> = {
  'Barack Obama':     { rate: 0.82, pitch: 0.88, volume: 0.9 },
  'Steve Jobs':       { rate: 1.00, pitch: 1.05, volume: 1.0 },
  'Shashi Tharoor':   { rate: 0.92, pitch: 1.00, volume: 0.95 },
  'Winston Churchill':{ rate: 0.76, pitch: 0.82, volume: 1.0 },
  default:            { rate: 0.90, pitch: 1.00, volume: 0.95 },
}

let _synth: SpeechSynthesis | null = null
let _currentUtterance: SpeechSynthesisUtterance | null = null

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  if (!_synth) _synth = window.speechSynthesis
  return _synth
}

/** Stop any currently playing speech */
export function stopSpeaking(): void {
  const synth = getSynth()
  if (synth) {
    synth.cancel()
    _currentUtterance = null
  }
}

/** Speak text with the voice profile of the given speaker name */
export function speak(
  text: string,
  speakerName: string,
  onEnd?: () => void,
): void {
  const synth = getSynth()
  if (!synth) return

  synth.cancel() // stop anything already playing

  const profile = SPEAKER_PROFILES[speakerName] ?? SPEAKER_PROFILES['default']
  const utt = new SpeechSynthesisUtterance(text)

  utt.rate   = profile.rate
  utt.pitch  = profile.pitch
  utt.volume = profile.volume

  // Pick the best available voice (prefer a natural English voice)
  const voices = synth.getVoices()
  const english = voices.filter(v => v.lang.startsWith('en'))
  if (english.length > 0) {
    // Prefer a non-default voice for more variety
    utt.voice = english[Math.floor(english.length / 2)] ?? english[0]
  }

  if (onEnd) utt.onend = onEnd
  _currentUtterance = utt
  synth.speak(utt)
}

/** Promise-based speak — resolves when speech ends */
export function speakAsync(text: string, speakerName: string): Promise<void> {
  return new Promise((resolve) => {
    speak(text, speakerName, resolve)
  })
}

/** True if speech synthesis is available in this browser */
export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Pre-load voices (must be called after user gesture in some browsers) */
export function preloadVoices(): void {
  const synth = getSynth()
  if (synth) synth.getVoices()
}
