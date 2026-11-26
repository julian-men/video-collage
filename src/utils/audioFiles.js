const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mpeg3',
  'audio/x-mpeg-3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/x-aac',
  'audio/ogg',
  'audio/vorbis',
  'audio/opus',
])
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga']

export const SOUNDTRACK_FORMATS_LABEL = 'MP3, WAV, M4A/AAC, or OGG'

export const SOUNDTRACK_ACCEPT = [
  ...AUDIO_MIME_TYPES,
  ...AUDIO_EXTENSIONS.map((extension) => `.${extension}`),
].join(',')

// Some systems report an empty MIME type, so fall back to the file extension.
export function isSoundtrackFile(file) {
  if (file.type) return AUDIO_MIME_TYPES.has(file.type)
  const extension = file.name.split('.').pop().toLowerCase()
  return AUDIO_EXTENSIONS.includes(extension)
}

// Returns a reason string when the file can't be used, otherwise null. Passing
// this check only means the file claims to be audio; decoding proves it.
export function validateSoundtrackFile(file) {
  if (file.size === 0) return 'the file is empty'
  if (isSoundtrackFile(file)) return null
  return 'it is not a supported audio file'
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
