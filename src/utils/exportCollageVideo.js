import { EXPORT_FILE_BASENAME } from '../appInfo.js'
import { revealCountAt } from './revealTimeline.js'
import { getTileRect } from './tileLayout.js'

export const SHORT_EXPORT_SECONDS = 5
const STOP_TIMEOUT_MS = 3000
// Finalizing a long recording takes longer, so the stop timeout grows with it.
const STOP_TIMEOUT_PER_MINUTE_MS = 1000
// The backup stop for a full-soundtrack export, past the end of the song. It
// only fires if the export audio clock stalls.
const FULL_BACKUP_GRACE_MS = 5000
const FULL_BACKUP_GRACE_RATIO = 0.02
const PROGRESS_STEP_SECONDS = 0.25
const IMAGE_TIMEOUT_MS = 5000
const SOUNDTRACK_DECODE_TIMEOUT_MS = 10000
const AUDIO_START_TIMEOUT_MS = 3000
const AUDIO_BITS_PER_SECOND = 128_000
const TRACK_WARMUP_MS = 150
const FRAME_RATE = 30
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

function pickMimeType(format, withAudio = false) {
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

function getAudioContextClass() {
  if (typeof window === 'undefined') return null
  return window.AudioContext ?? window.webkitAudioContext ?? null
}

function canMixAudio() {
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

function unsupportedMessage(format, withAudio) {
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
function lacksAudioCodec(type) {
  const codecs = /codecs="?([^";]+)/i.exec(type)?.[1]
  if (!codecs) return false
  return !/mp4a|opus|vorbis|aac|flac|pcm/i.test(codecs)
}

function cancelledError() {
  return new ExportError('Export was cancelled.')
}

function withTimeout(promise, ms, message) {
  let timer = null
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ExportError(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function abortable(promise, signal) {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(cancelledError())
  let onAbort = null
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(cancelledError())
    signal.addEventListener('abort', onAbort, { once: true })
  })
  return Promise.race([promise, aborted]).finally(() =>
    signal.removeEventListener('abort', onAbort),
  )
}

// Worker ticks keep their rate when the page is hidden or covered, where
// main-thread timers drop to about 1 Hz. Falls back to a timer if workers fail.
function startFrameClock(onTick) {
  const intervalMs = 1000 / FRAME_RATE
  let worker = null
  let fallback = null
  const startTimer = () => {
    if (fallback === null) fallback = setInterval(onTick, intervalMs)
  }
  try {
    worker = new Worker(new URL('../workers/frameClockWorker.js', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = onTick
    worker.onerror = () => {
      worker?.terminate()
      worker = null
      startTimer()
    }
    worker.postMessage({ intervalMs })
  } catch {
    worker = null
    startTimer()
  }
  return () => {
    worker?.terminate()
    worker = null
    clearInterval(fallback)
  }
}

async function decodeSoundtrack(audioContext, url) {
  try {
    const response = await fetch(url)
    const data = await response.arrayBuffer()
    const buffer = await audioContext.decodeAudioData(data)
    if (!buffer || !(buffer.duration > 0)) throw new Error('empty')
    return buffer
  } catch {
    throw new ExportError('The soundtrack could not be decoded for export.')
  }
}

function releaseMedia(element) {
  if (element instanceof HTMLVideoElement) {
    element.onloadeddata = null
    element.onerror = null
    element.pause()
    element.removeAttribute('src')
    element.load()
  } else {
    element.onload = null
    element.onerror = null
    element.removeAttribute('src')
  }
}

// Recording failures for MP4 point the user at WebM instead of switching
// formats behind their back.
function recordingError(format, reason) {
  if (format !== 'mp4') return new ExportError(reason)
  return new ExportError(`MP4 recording failed. ${reason} ${MP4_FALLBACK_HINT}`)
}

function loadImage(url, message = 'The background image could not be loaded.') {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const fail = () => {
      clearTimeout(timer)
      reject(new ExportError(message))
    }
    const timer = setTimeout(fail, IMAGE_TIMEOUT_MS)
    image.onload = () => {
      clearTimeout(timer)
      resolve(image)
    }
    image.onerror = fail
    image.src = url
  })
}

// Snapshot of every rendered tile so later drags or resizes don't affect the
// recording. Coordinates are in workspace CSS pixels.
function measureTiles(workspace) {
  const origin = workspace.getBoundingClientRect()
  return [...workspace.querySelectorAll('.media-tile')]
    .filter((tile) => tile.querySelector('.media-tile__media'))
    .map((tile) => {
      const media = tile.querySelector('.media-tile__media')
      const rect = media.getBoundingClientRect()
      return {
        media,
        zIndex: Number(tile.style.zIndex) || 0,
        x: rect.left - origin.left,
        y: rect.top - origin.top,
        width: rect.width,
        height: rect.height,
      }
    })
    .sort((a, b) => a.zIndex - b.zIndex)
}

function loadRevealMedia(item, created) {
  return new Promise((resolve, reject) => {
    const isVideo = item.type === 'video'
    const element = isVideo ? document.createElement('video') : new Image()
    created.push(element)
    const fail = () => {
      clearTimeout(timer)
      reject(new ExportError(`“${item.name}” could not be loaded for export.`))
    }
    const timer = setTimeout(fail, IMAGE_TIMEOUT_MS)
    const ready = () => {
      clearTimeout(timer)
      resolve(element)
    }
    element.onerror = fail
    if (isVideo) {
      element.muted = true
      element.loop = true
      element.playsInline = true
      element.preload = 'auto'
      // Wait until a frame can be drawn, not only until metadata arrives.
      element.onloadeddata = () => {
        if (element.videoWidth > 0) ready()
        else element.addEventListener('seeked', ready, { once: true })
      }
    } else {
      element.onload = ready
    }
    element.src = item.url
  })
}

/**
 * Separate media elements for every item in upload order, placed from each
 * item's saved position, width, aspect ratio, and z-index, so hidden items can
 * be recorded and the live tiles are never touched. Failed items keep their
 * place in the reveal order but draw nothing, like the full-collage export.
 */
async function loadRevealTiles(items, workspaceSize, created, signal) {
  const tiles = await abortable(
    Promise.all(
      items.map(async (item, index) => {
        if (item.loadError) return null
        const media = await loadRevealMedia(item, created)
        const rect = getTileRect(item, workspaceSize)
        return {
          index,
          media,
          zIndex: item.zIndex,
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.width / item.aspectRatio,
        }
      }),
    ),
    signal,
  )
  return tiles.filter(Boolean).sort((a, b) => a.zIndex - b.zIndex)
}

function cssColor(name, fallback) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return value || fallback
}

function fillSoftEllipse(ctx, cx, cy, rx, ry, alpha) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(rx, ry)
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
  gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

function fillBubble(ctx, x, y, size) {
  const r = size / 2
  const gradient = ctx.createRadialGradient(
    x + size * 0.35,
    y + size * 0.3,
    0,
    x + r,
    y + r,
    r,
  )
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.25)')
  gradient.addColorStop(0.85, 'rgba(160, 225, 255, 0.12)')
  gradient.addColorStop(0.95, 'rgba(255, 255, 255, 0.6)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x + r, y + r, r, 0, Math.PI * 2)
  ctx.fill()
}

// Canvas approximation of the CSS sky, clouds, bubbles, and hills in App.css.
function drawDefaultScene(ctx, width, height) {
  const sky = ctx.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, cssColor('--sky-top', '#2fa9ec'))
  sky.addColorStop(0.42, cssColor('--sky-mid', '#8fd6ff'))
  sky.addColorStop(0.72, cssColor('--sky-low', '#dcf5ff'))
  sky.addColorStop(1, cssColor('--meadow', '#b9eb9a'))
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)

  // The CSS cloud layer spans -10%..110% horizontally and -5%..60% vertically.
  const boxX = -0.1 * width
  const boxY = -0.05 * height
  const boxW = 1.2 * width
  const boxH = 0.65 * height
  const clouds = [
    [14, 7, 18, 22, 0.95],
    [9, 6, 24, 18, 0.9],
    [18, 8, 62, 30, 0.85],
    [10, 6, 68, 25, 0.9],
    [12, 5, 88, 14, 0.8],
    [60, 40, 50, -10, 0.45],
  ]
  for (const [rx, ry, cx, cy, alpha] of clouds) {
    fillSoftEllipse(
      ctx,
      boxX + (cx / 100) * boxW,
      boxY + (cy / 100) * boxH,
      (rx / 100) * boxW,
      (ry / 100) * boxH,
      alpha,
    )
  }

  const hills = [
    [50, 112, 70, 18, '#9be36a'],
    [85, 112, 60, 26, '#5fc23a'],
    [20, 108, 55, 22, '#7fd650'],
  ]
  for (const [cx, cy, rx, ry, color] of hills) {
    fillEllipse(
      ctx,
      (cx / 100) * width,
      (cy / 100) * height,
      (rx / 100) * width * 0.6,
      (ry / 100) * height * 0.6,
      color,
    )
  }

  const bubbles = [
    [84, 42, 110],
    [92, 60, 60],
    [58, 68, 44],
    [40, 52, 26],
  ]
  for (const [px, py, size] of bubbles) {
    fillBubble(
      ctx,
      (px / 100) * (width - size),
      (py / 100) * (height - size),
      size,
    )
  }
}

// Matches CSS `background-size: cover; background-position: center`.
function drawCoverImage(ctx, image, width, height) {
  ctx.fillStyle = cssColor('--sky-mid', '#8fd6ff')
  ctx.fillRect(0, 0, width, height)
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  ctx.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  )
}

function drawTiles(ctx, tiles) {
  for (const tile of tiles) {
    const { media } = tile
    const ready =
      media instanceof HTMLVideoElement
        ? media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        : media.complete && media.naturalWidth > 0
    ctx.fillStyle = '#000'
    ctx.fillRect(tile.x, tile.y, tile.width, tile.height)
    if (ready) ctx.drawImage(media, tile.x, tile.y, tile.width, tile.height)
  }
}

// Matches the tiles' `object-fit: contain` on a black tile background, so an
// item whose saved aspect ratio differs from its file is letterboxed, not
// stretched.
function drawRevealTiles(ctx, tiles, count) {
  for (const tile of tiles) {
    if (tile.index >= count) continue
    const { media } = tile
    ctx.fillStyle = '#000'
    ctx.fillRect(tile.x, tile.y, tile.width, tile.height)
    const isVideo = media instanceof HTMLVideoElement
    const naturalWidth = isVideo ? media.videoWidth : media.naturalWidth
    const naturalHeight = isVideo ? media.videoHeight : media.naturalHeight
    const ready = isVideo
      ? media.videoWidth > 0
      : media.complete
    if (!ready || !naturalWidth || !naturalHeight) continue
    const scale = Math.min(tile.width / naturalWidth, tile.height / naturalHeight)
    const width = naturalWidth * scale
    const height = naturalHeight * scale
    ctx.drawImage(
      media,
      tile.x + (tile.width - width) / 2,
      tile.y + (tile.height - height) / 2,
      width,
      height,
    )
  }
}

// Rounds down so the canvas never exceeds the preset's maximum.
function evenSize(value) {
  return Math.max(2, Math.floor(value / 2) * 2)
}

/**
 * Largest even-sized canvas that fits inside the preset's bounds with the
 * workspace's own aspect ratio. Small workspaces are scaled up, so videos and
 * images are drawn from their full-resolution elements at the export size.
 */
export function exportCanvasSize(workspaceWidth, workspaceHeight, quality) {
  const preset = EXPORT_QUALITIES[quality] ?? EXPORT_QUALITIES[DEFAULT_EXPORT_QUALITY]
  const scale = Math.min(
    preset.maxWidth / workspaceWidth,
    preset.maxHeight / workspaceHeight,
  )
  return {
    width: evenSize(workspaceWidth * scale),
    height: evenSize(workspaceHeight * scale),
  }
}

export function exportFileName(format) {
  return `${EXPORT_FILE_BASENAME}.${EXPORT_FORMATS[format].extension}`
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Records a video of the collage and downloads it.
 *
 * Without `reveal`, the rendered tiles are recorded as they are. With
 * `reveal`, the sequence is replayed from its start using
 * `{ items, timeline, soundtrackUrl }`: `items` in upload order, a
 * revealTimeline `timeline`, and, for music sync, the soundtrack to mix in.
 * The soundtrack's export clock then decides which items are visible.
 *
 * `length` is `'short'` (five seconds, padded with silence if the soundtrack
 * is shorter) or `'full'` (exactly the soundtrack's duration, which needs a
 * soundtrack). `onProgress({ elapsed, duration })` reports recorded seconds.
 */
export async function exportCollageVideo({
  workspace,
  background,
  quality = DEFAULT_EXPORT_QUALITY,
  format,
  reveal = null,
  length = 'short',
  onProgress,
  signal,
}) {
  if (!EXPORT_FORMATS[format]) throw new ExportError('Unknown export format.')
  const withAudio = Boolean(reveal?.soundtrackUrl)
  const isFull = length === 'full'
  if (isFull && !withAudio) {
    throw new ExportError('A full-soundtrack export needs a music-synchronized reveal.')
  }
  const { container } = EXPORT_FORMATS[format]
  const preset = EXPORT_QUALITIES[quality] ?? EXPORT_QUALITIES[DEFAULT_EXPORT_QUALITY]
  const mimeType = pickMimeType(format, withAudio)
  const canvas = document.createElement('canvas')
  if (
    !mimeType ||
    typeof canvas.captureStream !== 'function' ||
    (withAudio && !canMixAudio())
  ) {
    throw new ExportError(unsupportedMessage(format, withAudio))
  }
  if (!workspace) throw new ExportError('The collage workspace is not available.')

  const liveTiles = reveal ? null : measureTiles(workspace)
  if (reveal ? reveal.items.length === 0 : liveTiles.length === 0) {
    throw new ExportError('There is no media to export.')
  }

  const { width: workspaceWidth, height: workspaceHeight } =
    workspace.getBoundingClientRect()
  const size = exportCanvasSize(workspaceWidth, workspaceHeight, quality)

  let isDone = false
  let stopFrameClock = null
  let warmupTimer = null
  let durationTimer = null
  let stopTimer = null
  let canvasStream = null
  let stream = null
  let recorder = null
  let audioContext = null
  let audioSource = null
  let silenceSource = null
  let audioDestination = null
  let onAbort = null
  const revealMedia = []
  try {
    // Created before the first await so it still counts as started by the
    // Export click, which browsers require before audio may run.
    if (withAudio) audioContext = new (getAudioContextClass())()

    const soundtrack = withAudio
      ? await abortable(
          withTimeout(
            decodeSoundtrack(audioContext, reveal.soundtrackUrl),
            SOUNDTRACK_DECODE_TIMEOUT_MS,
            'The soundtrack took too long to prepare for export.',
          ),
          signal,
        )
      : null
    const backgroundImage = background
      ? await abortable(loadImage(background.url), signal)
      : null
    const revealTiles = reveal
      ? await loadRevealTiles(
          reveal.items,
          { width: workspaceWidth, height: workspaceHeight },
          revealMedia,
          signal,
        )
      : null

    if (audioContext && audioContext.state !== 'running') {
      await abortable(
        withTimeout(
          audioContext.resume(),
          AUDIO_START_TIMEOUT_MS,
          "The browser didn't let the soundtrack start. Press Export again.",
        ),
        signal,
      )
      if (audioContext.state !== 'running') {
        throw new ExportError(
          "The browser didn't let the soundtrack start. Press Export again.",
        )
      }
    }

    const durationSeconds = isFull ? soundtrack.duration : SHORT_EXPORT_SECONDS
    const durationMs = durationSeconds * 1000
    const stopTimeoutMs =
      STOP_TIMEOUT_MS + STOP_TIMEOUT_PER_MINUTE_MS * Math.floor(durationSeconds / 60)

    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Seconds since the sequence started. With a soundtrack this reads the
    // export audio clock and stops advancing when the audio ends, so the
    // visuals can't drift from the recorded sound.
    let clockStart = null
    function sequenceTime() {
      if (clockStart === null) return 0
      if (audioContext) {
        return Math.min(audioContext.currentTime - clockStart, soundtrack.duration)
      }
      return (performance.now() - clockStart) / 1000
    }

    let startedVideos = 0
    function drawFrame() {
      ctx.setTransform(
        canvas.width / workspaceWidth,
        0,
        0,
        canvas.height / workspaceHeight,
        0,
        0,
      )
      if (backgroundImage) {
        drawCoverImage(ctx, backgroundImage, workspaceWidth, workspaceHeight)
      } else {
        drawDefaultScene(ctx, workspaceWidth, workspaceHeight)
      }
      if (!reveal) {
        drawTiles(ctx, liveTiles)
        return
      }
      const count = revealCountAt(reveal.timeline, sequenceTime(), reveal.items.length)
      // A repeating reveal hides everything for one step; hidden videos stop
      // so they start over when the next cycle reveals them.
      if (count < startedVideos) {
        for (const tile of revealTiles) {
          if (tile.index >= count && tile.media instanceof HTMLVideoElement) {
            tile.media.pause()
          }
        }
        startedVideos = count
      }
      // Like the live tiles, a video starts from the beginning when revealed.
      // Seeking to 0 when already there can drop the current frame and leave
      // the tile black until a later seeked event, so only rewind if needed.
      if (count > startedVideos) {
        for (const tile of revealTiles) {
          if (tile.index < startedVideos || tile.index >= count) continue
          if (!(tile.media instanceof HTMLVideoElement)) continue
          const media = tile.media
          const play = () => media.play().catch(() => {})
          if (media.currentTime > 0.05) {
            media.addEventListener('seeked', play, { once: true })
            media.currentTime = 0
          } else {
            play()
          }
        }
        startedVideos = count
      }
      drawRevealTiles(ctx, revealTiles, count)
    }

    drawFrame()
    canvasStream = canvas.captureStream(FRAME_RATE)
    if (audioContext) {
      audioDestination = audioContext.createMediaStreamDestination()
      audioSource = audioContext.createBufferSource()
      audioSource.buffer = soundtrack
      // Only the recording destination is connected, never the speakers.
      audioSource.connect(audioDestination)
      // Chrome stops sending audio once the soundtrack ends, which would leave
      // a five-second file's audio shorter than its video. This keeps silence
      // flowing. A full-soundtrack export ends with the song, so it has none.
      if (!isFull) {
        silenceSource = audioContext.createConstantSource()
        silenceSource.offset.value = 0
        silenceSource.connect(audioDestination)
        silenceSource.start()
      }
      stream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ])
    } else {
      stream = canvasStream
    }

    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: preset.videoBitsPerSecond,
        ...(withAudio && { audioBitsPerSecond: AUDIO_BITS_PER_SECOND }),
      })
    } catch {
      throw recordingError(
        format,
        withAudio
          ? 'The browser rejected the recorder settings for video with soundtrack audio.'
          : 'The browser rejected the recorder settings.',
      )
    }
    const activeRecorder = recorder
    // Never hand back a different container than the one the user picked.
    const recorderType = () => activeRecorder.mimeType || mimeType
    if (!recorderType().startsWith(container)) {
      throw recordingError(format, `The browser offered ${recorderType()} instead.`)
    }

    const chunks = []
    activeRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }

    let failRecording = null
    let drawFailed = false
    let recordingStartedAt = null
    let stopRecording = null
    let reportedProgress = -Infinity
    // A five-second export is timed by the wall clock. A full-soundtrack
    // export is timed by the export audio clock, so it ends with the song.
    function elapsedSeconds() {
      if (recordingStartedAt === null) return 0
      if (isFull) return audioContext.currentTime - clockStart
      return (performance.now() - recordingStartedAt) / 1000
    }
    function reportProgress(elapsed) {
      if (!onProgress) return
      const clamped = Math.min(Math.max(0, elapsed), durationSeconds)
      if (clamped < durationSeconds && clamped - reportedProgress < PROGRESS_STEP_SECONDS) {
        return
      }
      reportedProgress = clamped
      onProgress({ elapsed: clamped, duration: durationSeconds })
    }
    function tick() {
      if (isDone) return
      // Main-thread timers can fire a second late while the window isn't
      // focused; the frame clock keeps time, so it ends the recording.
      const elapsed = elapsedSeconds()
      if (recordingStartedAt !== null && elapsed >= durationSeconds) {
        stopRecording?.()
        return
      }
      if (recordingStartedAt !== null) reportProgress(elapsed)
      try {
        drawFrame()
      } catch {
        drawFailed = true
        failRecording?.(new ExportError('A media item could not be drawn.'))
      }
    }

    // A clock, not requestAnimationFrame: animation frames stop while the
    // page isn't painted (hidden tab, covered window), and an MP4 ends at
    // its last frame, so a stalled loop would cut the video short.
    stopFrameClock = startFrameClock(tick)
    // Both tracks must already be delivering when the recorder starts.
    // Otherwise a muxer can start the video track's timeline at its first
    // late frame, and reveals land after their beats in the file.
    await abortable(
      new Promise((resolve) => {
        warmupTimer = setTimeout(resolve, TRACK_WARMUP_MS)
      }),
      signal,
    )
    if (drawFailed) throw new ExportError('A media item could not be drawn.')

    // Every way the recording can end funnels through this one promise, so it
    // always settles: normal stop, recorder error, draw error, stop timeout,
    // or cancellation.
    await new Promise((resolve, reject) => {
      const finish = (error) => {
        if (isDone) return
        isDone = true
        if (error) reject(error)
        else resolve()
      }
      failRecording = finish

      activeRecorder.onstop = () => finish()
      activeRecorder.onerror = () =>
        finish(
          recordingError(
            format,
            withAudio
              ? 'The video or audio encoder reported an error.'
              : 'The video encoder reported an error.',
          ),
        )
      if (signal) {
        if (signal.aborted) {
          finish(cancelledError())
          return
        }
        onAbort = () => finish(cancelledError())
        signal.addEventListener('abort', onAbort, { once: true })
      }

      stopRecording = () => {
        if (stopRecording === null) return
        stopRecording = null
        clearTimeout(durationTimer)
        reportProgress(durationSeconds)
        try {
          if (activeRecorder.state !== 'inactive') activeRecorder.stop()
        } catch {
          finish(recordingError(format, 'Recording could not be stopped.'))
          return
        }
        stopTimer = setTimeout(
          () =>
            finish(
              recordingError(format, 'Recording did not finish. Please try again.'),
            ),
          stopTimeoutMs,
        )
      }

      try {
        activeRecorder.start(250)
        recordingStartedAt = performance.now()
        if (audioSource) {
          // The song's own end stops a full export as soon as it happens.
          if (isFull) audioSource.onended = () => stopRecording?.()
          audioSource.start()
          clockStart = audioContext.currentTime
        } else {
          clockStart = performance.now()
        }
      } catch {
        finish(recordingError(format, 'Recording could not be started.'))
        return
      }
      reportProgress(0)
      if (isFull) {
        // Only reached if the audio clock stops advancing, which would leave
        // the reveal and the file out of step with the song.
        durationTimer = setTimeout(
          () =>
            finish(
              recordingError(
                format,
                'The soundtrack stopped playing during export. Keep the page open and try again.',
              ),
            ),
          durationMs * (1 + FULL_BACKUP_GRACE_RATIO) + FULL_BACKUP_GRACE_MS,
        )
      } else {
        durationTimer = setTimeout(() => stopRecording?.(), durationMs)
      }
    })

    if (chunks.length === 0) {
      throw recordingError(format, 'The recording came out empty.')
    }
    const type = recorderType()
    if (!type.startsWith(container)) {
      throw recordingError(format, `The browser recorded ${type} instead.`)
    }
    if (withAudio && lacksAudioCodec(type)) {
      throw recordingError(format, 'The browser recorded the video without the soundtrack.')
    }
    if (signal?.aborted) throw cancelledError()
    const fileName = exportFileName(format)
    downloadBlob(new Blob(chunks, { type }), fileName)
    return {
      fileName,
      mimeType: type,
      width: size.width,
      height: size.height,
      hasAudio: withAudio,
      durationSeconds,
    }
  } finally {
    isDone = true
    if (onAbort) signal.removeEventListener('abort', onAbort)
    clearTimeout(warmupTimer)
    clearTimeout(durationTimer)
    clearTimeout(stopTimer)
    stopFrameClock?.()
    if (recorder) {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.onerror = null
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } catch {
        // Already stopped by the browser; nothing left to release.
      }
    }
    if (audioSource) {
      audioSource.onended = null
      try {
        audioSource.stop()
      } catch {
        // Never started, or already finished.
      }
      audioSource.disconnect()
    }
    if (silenceSource) {
      silenceSource.stop()
      silenceSource.disconnect()
    }
    audioDestination?.disconnect()
    audioContext?.close().catch(() => {})
    const tracks = new Set([
      ...(stream?.getTracks() ?? []),
      ...(canvasStream?.getTracks() ?? []),
      ...(audioDestination?.stream.getTracks() ?? []),
    ])
    tracks.forEach((track) => track.stop())
    revealMedia.forEach(releaseMedia)
    canvas.width = 0
    canvas.height = 0
  }
}

