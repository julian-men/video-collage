const MP3_MIME_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3'])

export const SOUNDTRACK_ACCEPT = [...MP3_MIME_TYPES, '.mp3'].join(',')

// Returns a reason string when the file can't be used, otherwise null. Passing
// this check only means the file claims to be an MP3; decoding proves it.
export function validateSoundtrackFile(file) {
  if (file.size === 0) return 'the file is empty'
  const isMp3Name = file.name.toLowerCase().endsWith('.mp3')
  if (file.type ? MP3_MIME_TYPES.has(file.type) : isMp3Name) return null
  return 'it is not an MP3 audio file'
}

export class SoundtrackDecodeError extends Error {}

export async function decodeAudioFile(file) {
  const OfflineContext = window.OfflineAudioContext ?? window.webkitOfflineAudioContext
  if (!OfflineContext) return null
  const data = await file.arrayBuffer()
  const context = new OfflineContext(1, 1, 44100)
  try {
    const buffer = await context.decodeAudioData(data)
    if (!buffer || buffer.length === 0 || !(buffer.duration > 0)) {
      throw new SoundtrackDecodeError()
    }
    return buffer
  } catch {
    throw new SoundtrackDecodeError()
  }
}
