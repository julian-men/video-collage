import {
  AUDIO_BITS_PER_SECOND,
  DEFAULT_EXPORT_FRAME,
  DEFAULT_EXPORT_QUALITY,
  EXPORT_FORMATS,
  EXPORT_QUALITIES,
  ExportError,
  SHORT_EXPORT_SECONDS,
  canMixAudio,
  exportFileName,
  exportFrameLayout,
  getAudioContextClass,
  lacksAudioCodec,
  pickMimeType,
  recordingError,
  unsupportedMessage,
} from './exportSettings.js'
import { drawCoverImage, drawDefaultScene, drawTile } from './exportDrawing.js'
import {
  abortable,
  cancelledError,
  liveTiles,
  loadImage,
  loadRevealTiles,
  releaseMedia,
  withTimeout,
} from './exportMedia.js'
import { revealCountAt } from './revealTimeline.js'

const STOP_TIMEOUT_MS = 3000
// Finalizing a long recording takes longer, so the stop timeout grows with it.
const STOP_TIMEOUT_PER_MINUTE_MS = 1000
// The backup stop for a full-soundtrack export, past the end of the song. It
// only fires if the export audio clock stalls.
const FULL_BACKUP_GRACE_MS = 5000
const FULL_BACKUP_GRACE_RATIO = 0.02
const PROGRESS_STEP_SECONDS = 0.25
const SOUNDTRACK_DECODE_TIMEOUT_MS = 10000
const AUDIO_START_TIMEOUT_MS = 3000
const TRACK_WARMUP_MS = 150
const FRAME_RATE = 30

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
  frame = DEFAULT_EXPORT_FRAME,
  format,
  items = [],
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

  const { width: workspaceWidth, height: workspaceHeight } =
    workspace.getBoundingClientRect()
  const workspaceSize = { width: workspaceWidth, height: workspaceHeight }
  const collageTiles = reveal ? null : liveTiles(items, workspace, workspaceSize)
  if (reveal ? reveal.items.length === 0 : collageTiles.length === 0) {
    throw new ExportError('There is no media to export.')
  }
  const size = exportFrameLayout(workspaceWidth, workspaceHeight, frame, quality)

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
      ? await loadRevealTiles(reveal.items, workspaceSize, revealMedia, signal)
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
      // The background fills the whole frame, in workspace-sized units so the
      // default scene's clouds and bubbles keep their on-screen size.
      ctx.setTransform(size.scale, 0, 0, size.scale, 0, 0)
      if (backgroundImage) {
        drawCoverImage(ctx, backgroundImage, size.width / size.scale, size.height / size.scale)
      } else {
        drawDefaultScene(ctx, size.width / size.scale, size.height / size.scale)
      }
      ctx.setTransform(size.scale, 0, 0, size.scale, size.offsetX, size.offsetY)
      if (!reveal) {
        collageTiles.forEach((tile) => drawTile(ctx, tile))
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
      for (const tile of revealTiles) {
        if (tile.index < count) drawTile(ctx, tile)
      }
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

