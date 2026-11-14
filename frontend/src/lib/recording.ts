'use client'

export interface RecorderSetup {
  recorder: MediaRecorder
  stream: MediaStream
}

export type MicPermissionState = 'unknown' | 'checking' | 'granted' | 'denied' | 'prompt'

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function microphoneErrorMessage(error: unknown): string {
  if (typeof window !== 'undefined') {
    if (!window.isSecureContext && !isLocalhost(window.location.hostname)) {
      return 'Microphone recording only works on HTTPS or localhost. Open the app at http://localhost:3000.'
    }
  }

  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Microphone permission denied. Click the 🔒 icon in the address bar → Site settings → Allow Microphone, then refresh this page.'
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No microphone found. Please connect a microphone and try again.'
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Microphone is in use by another app. Close other apps using it and try again.'
      case 'OverconstrainedError':
        return 'Microphone does not support the required settings. Try a different input device.'
      default:
        break
    }
  }

  return 'Could not start the microphone. Please check permissions in browser settings and try again.'
}

function supportedAudioMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  return candidates.find(type => MediaRecorder.isTypeSupported(type))
}

/** Check current mic permission state without requesting it. */
export async function checkMicPermission(): Promise<MicPermissionState> {
  if (typeof navigator === 'undefined') return 'unknown'
  try {
    // @ts-expect-error - 'microphone' is valid but not in all TS lib types
    const result = await navigator.permissions.query({ name: 'microphone' })
    return result.state as MicPermissionState
  } catch {
    // Firefox doesn't support querying microphone permission
    return 'unknown'
  }
}

/** Request mic permission proactively (shows browser prompt). Returns true if granted. */
export async function requestMicPermission(): Promise<{ granted: boolean; error?: string }> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { granted: false, error: 'This browser does not support microphone access.' }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach(t => t.stop())   // release immediately, we just wanted the grant
    return { granted: true }
  } catch (error) {
    return { granted: false, error: microphoneErrorMessage(error) }
  }
}

export async function createAudioRecorder(): Promise<RecorderSetup> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    throw new Error('Recording is only available in the browser.')
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support microphone recording. Try Chrome, Edge, or Firefox.')
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    const mimeType = supportedAudioMimeType()
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

    return { recorder, stream }
  } catch (error) {
    throw new Error(microphoneErrorMessage(error))
  }
}

export function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach(track => track.stop())
}
