const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'webm', 'ogv'])
const PROBE_TIMEOUT_MS = 15000

export const MEDIA_ACCEPT = [
  'video/*',
  ...IMAGE_MIME_TYPES,
  ...[...IMAGE_EXTENSIONS].map((extension) => `.${extension}`),
].join(',')

export const SUPPORTED_MEDIA_DESCRIPTION =
  'Supported collage media: common video formats (such as MP4 and WebM) and PNG, JPG/JPEG, GIF, and WebP images.'

// Some systems report an empty MIME type, so fall back to the file extension.
function getMediaType(file) {
  if (file.type.startsWith('video/')) return 'video'
  if (IMAGE_MIME_TYPES.has(file.type)) return 'image'
  if (file.type) return null
  const extension = file.name.split('.').pop().toLowerCase()
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  return null
}

export function validateMediaFile(file) {
  if (file.size === 0) return { reason: 'the file is empty' }
  const type = getMediaType(file)
  if (!type) return { reason: 'unsupported file type' }
  return { type }
}

export function validateBackgroundFile(file) {
  if (file.size === 0) return 'the file is empty'
  if (!file.type.startsWith('image/')) return 'it is not an image file'
  return null
}

// Maps MediaError codes to plain-language messages. Raw errors are never shown.
export function describeLoadError(type, errorCode) {
  if (type === 'image') {
    return 'The image could not be decoded. The file may be damaged or in a format this browser cannot display.'
  }
  switch (errorCode) {
    case 2:
      return 'The video file could not be read.'
    case 3:
      return 'The video data could not be decoded. The file may be damaged.'
    case 4:
      return 'This browser cannot play this video. It may use an unsupported codec or container.'
    default:
      return 'The video could not be played in this browser.'
  }
}

export const NO_VIDEO_PICTURE_MESSAGE =
  'This file has no video picture to show (it may be audio-only).'

/**
 * Loads a file URL in a detached element to confirm the browser can render it.
 * Resolves with { ok: true }, { ok: false, message }, or { ok: null } when it
 * timed out or was cancelled. Never rejects.
 */
export function probeMedia(url, type) {
  let finish = () => {}
  const promise = new Promise((resolve) => {
    let done = false
    let element = null
    let timer = null

    finish = (result) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (element instanceof HTMLVideoElement) {
        element.onloadeddata = null
        element.onerror = null
        element.removeAttribute('src')
        element.load()
      } else if (element) {
        element.onload = null
        element.onerror = null
        element.removeAttribute('src')
      }
      resolve(result)
    }

    timer = setTimeout(() => finish({ ok: null }), PROBE_TIMEOUT_MS)

    if (type === 'video') {
      const video = document.createElement('video')
      element = video
      video.muted = true
      video.preload = 'auto'
      video.onloadeddata = () =>
        finish(
          video.videoWidth > 0 && video.videoHeight > 0
            ? { ok: true }
            : { ok: false, message: NO_VIDEO_PICTURE_MESSAGE },
        )
      video.onerror = () =>
        finish({ ok: false, message: describeLoadError('video', video.error?.code) })
      video.src = url
    } else {
      const image = new Image()
      element = image
      image.onload = () =>
        image.decode().then(
          () => finish({ ok: true }),
          () => finish({ ok: false, message: describeLoadError('image') }),
        )
      image.onerror = () => finish({ ok: false, message: describeLoadError('image') })
      image.src = url
    }
  })

  return { promise, cancel: () => finish({ ok: null }) }
}
