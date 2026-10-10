import { useEffect, useState } from 'react'
import {
  revealAnchor,
  revealStepAt,
  visibleCountForStep,
} from '../utils/beatSync.js'

const SYNC_EVENTS = [
  'play',
  'playing',
  'pause',
  'ended',
  'seeking',
  'seeked',
  'timeupdate',
  'ratechange',
  'emptied',
]
const BOUNDARY_SETTLE_MS = 2
const MIN_DELAY_MS = 4

/**
 * Derives the reveal position from the soundtrack's playback position, so the
 * reveal can never drift from the music: pausing, resuming, and seeking simply
 * re-read audio.currentTime. At most one timeout is pending, and only while
 * the audio plays.
 */
function useMusicSync(soundtrack, { enabled, totalCount, repeat }) {
  const [beatsPerReveal, setBeatsPerReveal] = useState(1)
  const [step, setStep] = useState(0)
  // Id of the track the sequence is running for. Reset clears it so nothing
  // shows until playback starts again; a new track clears it implicitly.
  const [armedTrackId, setArmedTrackId] = useState(null)

  const { track, bpm, firstBeat, offsetMs, audioRef } = soundtrack
  const isAvailable = track !== null && bpm !== null
  const isActive = enabled && isAvailable
  const anchor = isAvailable ? revealAnchor(firstBeat, offsetMs, bpm) : 0
  const isArmed = track !== null && armedTrackId === track.id

  useEffect(() => {
    const audio = audioRef.current
    if (!isActive || !audio) return
    const stepSeconds = (beatsPerReveal * 60) / bpm
    let timer = 0

    // Every update re-reads the audio clock and schedules a single timeout for
    // the next reveal boundary, so timing errors never accumulate.
    function update() {
      clearTimeout(timer)
      timer = 0
      const time = audio.currentTime
      const current = revealStepAt(time, anchor, bpm, beatsPerReveal)
      setStep(current)
      if (audio.paused) return
      const nextBoundary = anchor + current * stepSeconds
      const rate = audio.playbackRate || 1
      const delay = ((nextBoundary - time) / rate) * 1000 + BOUNDARY_SETTLE_MS
      timer = setTimeout(update, Math.max(MIN_DELAY_MS, delay))
    }

    const controller = new AbortController()
    const options = { signal: controller.signal }
    for (const type of SYNC_EVENTS) audio.addEventListener(type, update, options)
    timer = setTimeout(update, 0)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [isActive, anchor, bpm, beatsPerReveal, audioRef, track])

  const visibleCount =
    isActive && isArmed ? visibleCountForStep(step, totalCount, repeat) : 0

  function start() {
    if (!track) return
    setArmedTrackId(track.id)
    soundtrack.play()
  }

  function reset() {
    soundtrack.pause()
    soundtrack.seek(0)
    setArmedTrackId(null)
  }

  function seek(seconds) {
    soundtrack.seek(seconds)
    if (track) setArmedTrackId(track.id)
  }

  // Called when sync is switched on: mid-song it shows the current position
  // right away, at the very start it waits for Play.
  function armIfStarted() {
    if (track && (soundtrack.isPlaying || soundtrack.currentTime > 0)) {
      setArmedTrackId(track.id)
    } else {
      setArmedTrackId(null)
    }
  }

  return {
    isAvailable,
    isActive,
    isPlaying: soundtrack.isPlaying,
    isArmed,
    beatsPerReveal,
    visibleCount,
    armIfStarted,
    setBeatsPerReveal,
    start,
    pause: soundtrack.pause,
    toggle: () => (soundtrack.isPlaying ? soundtrack.pause() : start()),
    reset,
    seek,
  }
}

export default useMusicSync
