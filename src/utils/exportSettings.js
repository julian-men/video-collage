import { EXPORT_FILE_BASENAME } from '../appInfo.js'

// What can be exported and how big it will be. Shared by the panel and the
// recorder; nothing here touches the DOM until a support check is called.

export const SHORT_EXPORT_SECONDS = 5
export const AUDIO_BITS_PER_SECOND = 128_000
export const EXPORT_QUALITIES = {
  standard: {
    label: 'Standard',
    maxWidth: 1280,
    maxHeight: 720,
    videoBitsPerSecond: 8_000_000,
  },
  high: {
    label: 'High',
    maxWidth: 1920,
    maxHeight: 1080,
    videoBitsPerSecond: 16_000_000,
  },
}
export const DEFAULT_EXPORT_QUALITY = 'high'

// `aspect` null keeps the workspace's own shape.
export const EXPORT_FRAMES = {
  workspace: { label: 'Match workspace', aspect: null },
  landscape: { label: 'Landscape 16:9', aspect: 16 / 9 },
  portrait: { label: 'Portrait 9:16', aspect: 9 / 16 },
  square: { label: 'Square 1:1', aspect: 1 },
}
export const DEFAULT_EXPORT_FRAME = 'workspace'

/**
 * Upper estimate of the file size in bytes from the target bitrates. Browsers
 * often encode simple scenes below the target, so files are usually smaller.
 */
export function estimateExportBytes(quality, seconds, withAudio) {
  const preset = EXPORT_QUALITIES[quality] ?? EXPORT_QUALITIES[DEFAULT_EXPORT_QUALITY]
  const bitsPerSecond = preset.videoBitsPerSecond + (withAudio ? AUDIO_BITS_PER_SECOND : 0)
  return (bitsPerSecond * seconds) / 8
}

// Candidate MIME types are tried in order; the first one MediaRecorder accepts wins.
export const EXPORT_FORMATS = {
  mp4: {
    label: 'MP4',
    optionLabel: 'MP4 — best for phones',
    extension: 'mp4',
    container: 'video/mp4',
    mimeTypes: [
      'video/mp4;codecs=avc1.42E01E',
      'video/mp4;codecs=avc1.4D4028',
      'video/mp4',
    ],
    // H.264 video with AAC audio.
    audioMimeTypes: [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1.4D4028,mp4a.40.2',
      'video/mp4',
    ],
  },
  webm: {
    label: 'WebM',
    optionLabel: 'WebM',
    extension: 'webm',
    container: 'video/webm',
    mimeTypes: [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ],
    audioMimeTypes: [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ],
  },
}
export class ExportError extends Error {}

const MP4_FALLBACK_HINT = 'Select WebM under Export format and try again.'

export function pickMimeType(format, withAudio = false) {
  if (typeof MediaRecorder === 'undefined') return null
  if (typeof MediaRecorder.isTypeSupported !== 'function') return null
  const { mimeTypes, audioMimeTypes } = EXPORT_FORMATS[format]
  return (
    (withAudio ? audioMimeTypes : mimeTypes).find((type) =>
      MediaRecorder.isTypeSupported(type),
    ) ?? null
  )
}

function canCaptureCanvas() {
  return (
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  )
}

export function getAudioContextClass() {
  if (typeof window === 'undefined') return null
  return window.AudioContext ?? window.webkitAudioContext ?? null
}

export function canMixAudio() {
  const AudioContextClass = getAudioContextClass()
  return (
    AudioContextClass !== null &&
    typeof AudioContextClass.prototype.createMediaStreamDestination === 'function' &&
    typeof AudioContextClass.prototype.createConstantSource === 'function' &&
    typeof MediaStream !== 'undefined'
  )
}

/**
 * Which export formats this browser can record, keyed by format id. The
 * `<format>Audio` keys say whether that container can also carry the
 * soundtrack for a music-synchronized reveal.
 */
export function getExportFormatSupport() {
  const canCapture = canCaptureCanvas()
  const canAudio = canCapture && canMixAudio()
  const support = {}
  for (const format of Object.keys(EXPORT_FORMATS)) {
    support[format] = canCapture && pickMimeType(format) !== null
    support[`${format}Audio`] = canAudio && pickMimeType(format, true) !== null
  }
  return support
}

/** MP4 when the browser can record it, otherwise WebM. */
export function defaultExportFormat(support) {
  return support.mp4 ? 'mp4' : 'webm'
}

export function unsupportedMessage(format, withAudio) {
  if (withAudio && format === 'mp4') {
    return "This browser can't record MP4 with soundtrack audio. Select WebM under Export format to export the synchronized reveal."
  }
  if (withAudio) {
    return "This browser can't record WebM with soundtrack audio, so the synchronized reveal can't be exported here."
  }
  if (format === 'mp4') {
    return `This browser can't record MP4 video. ${MP4_FALLBACK_HINT}`
  }
  return 'This browser cannot record WebM video. Try a recent version of Chrome, Edge, or Firefox.'
}

// A codecs list without an audio codec means the soundtrack was dropped.
// Without a codecs list the container can't be checked, so it's accepted.
export function lacksAudioCodec(type) {
  const codecs = /codecs="?([^";]+)/i.exec(type)?.[1]
  if (!codecs) return false
  return !/mp4a|opus|vorbis|aac|flac|pcm/i.test(codecs)
}

// Recording failures for MP4 point the user at WebM instead of switching
// formats behind their back.
export function recordingError(format, reason) {
  if (format !== 'mp4') return new ExportError(reason)
  return new ExportError(`MP4 recording failed. ${reason} ${MP4_FALLBACK_HINT}`)
}

// Rounded to whole pixels first so float error (1679.9999) doesn't cost two
// pixels, then down to even, which never exceeds the preset's bounds.
function evenSize(value) {
  return Math.max(2, Math.floor(Math.round(value) / 2) * 2)
}

/**
 * Canvas size for the chosen frame shape, and where the workspace sits in it.
 * The preset's long and short sides are swapped for a portrait frame. The
 * workspace is scaled to fit inside the frame and centred; the background
 * fills the rest. Videos and images are drawn from their full-resolution
 * elements at that scale.
 */
export function exportFrameLayout(workspaceWidth, workspaceHeight, frame, quality) {
  const preset = EXPORT_QUALITIES[quality] ?? EXPORT_QUALITIES[DEFAULT_EXPORT_QUALITY]
  const aspect = EXPORT_FRAMES[frame]?.aspect ?? workspaceWidth / workspaceHeight
  const [boundWidth, boundHeight] =
    aspect < 1
      ? [preset.maxHeight, preset.maxWidth]
      : [preset.maxWidth, preset.maxHeight]
  const fitHeight = boundWidth / boundHeight > aspect
  const width = evenSize(fitHeight ? boundHeight * aspect : boundWidth)
  const height = evenSize(fitHeight ? boundHeight : boundWidth / aspect)
  const scale = Math.min(width / workspaceWidth, height / workspaceHeight)
  return {
    width,
    height,
    scale,
    offsetX: (width - workspaceWidth * scale) / 2,
    offsetY: (height - workspaceHeight * scale) / 2,
  }
}

export function exportFileName(format) {
  return `${EXPORT_FILE_BASENAME}.${EXPORT_FORMATS[format].extension}`
}
