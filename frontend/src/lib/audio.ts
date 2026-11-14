/**
 * audio.ts
 * ────────
 * Converts any browser-recorded audio blob (WebM, OGG, etc.) to 22 050 Hz
 * mono WAV before uploading to the backend.
 *
 * Why: librosa + soundfile can natively decode WAV without needing ffmpeg.
 * The browser's Web Audio API is used for decoding — no dependencies required.
 */

/**
 * Convert an audio Blob of any format the browser can decode (WebM, OGG, MP4…)
 * into a 22 050 Hz mono WAV Blob.
 *
 * Falls back to the original blob if conversion fails (e.g. Safari quirks),
 * so the upload can still proceed and the backend can try ffmpeg.
 */
export async function toWav(blob: Blob): Promise<Blob> {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const audioCtx = new AudioContext({ sampleRate: 22050 })

    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
      // Encode while context is still open — audioBuffer is guaranteed here
      const wavBlob = encodeWav(audioBuffer)
      return wavBlob
    } finally {
      // Always close the AudioContext to free resources, even on error
      audioCtx.close()
    }
  } catch (err) {
    console.warn('[toWav] conversion failed, sending original blob:', err)
    return blob
  }
}

// ── WAV encoder ──────────────────────────────────────────────────────────────

function encodeWav(buffer: AudioBuffer): Blob {
  const sampleRate = buffer.sampleRate
  // Mix down to mono by averaging all channels
  const numCh = buffer.numberOfChannels
  const length = buffer.length
  const mixed = new Float32Array(length)

  for (let ch = 0; ch < numCh; ch++) {
    const channelData = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      mixed[i] += channelData[i] / numCh
    }
  }

  // WAV = 44-byte header + 16-bit PCM samples
  const dataBytes = length * 2
  const wavBuffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(wavBuffer)

  // RIFF chunk
  writeStr(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeStr(view, 8, 'WAVE')

  // fmt  sub-chunk
  writeStr(view, 12, 'fmt ')
  view.setUint32(16, 16, true)           // sub-chunk size
  view.setUint16(20, 1, true)            // PCM = 1
  view.setUint16(22, 1, true)            // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true)            // block align (1 ch × 2 bytes)
  view.setUint16(34, 16, true)           // bits per sample

  // data sub-chunk
  writeStr(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  // PCM samples (16-bit signed little-endian)
  let offset = 44
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, mixed[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([wavBuffer], { type: 'audio/wav' })
}

function writeStr(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
