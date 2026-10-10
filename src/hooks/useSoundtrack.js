import { useEffect, useRef, useState } from 'react'
import { decodeAudioFile, validateSoundtrackFile } from '../utils/audioFiles.js'
import { parseBpm } from '../utils/beatSync.js'
import { LOW_CONFIDENCE } from '../utils/tempoAnalysis.js'

export const MAX_OFFSET_MS = 2000
const ANALYSIS_TIMEOUT_MS = 60000
const IDLE_ANALYSIS = { status: 'idle', progress: 0 }

function formatBpm(bpm) {
  return String(Math.round(bpm * 10) / 10)
}

function releaseAudio(audio) {
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
}

function stopJob(jobRef) {
  const job = jobRef.current
  if (!job) return
  clearTimeout(job.timer)
  job.worker.terminate()
  jobRef.current = null
}

function mixToMono(buffer) {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice()
  const mono = new Float32Array(buffer.length)
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i += 1) mono[i] += data[i]
  }
  for (let i = 0; i < mono.length; i += 1) mono[i] /= buffer.numberOfChannels
  return mono
}

/**
 * One soundtrack, played through a single detached <audio> element (never a
 * collage tile). Decoding and tempo analysis happen in the browser; analysis
 * runs in a worker so the interface stays responsive.
 */
function useSoundtrack(onProblem) {
  const [track, setTrack] = useState(null)
  const [pendingName, setPendingName] = useState(null)
  const [analysis, setAnalysis] = useState(IDLE_ANALYSIS)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bpmInput, setBpmInput] = useState('')
  const [offsetInput, setOffsetInput] = useState('0')

  const audioRef = useRef(null)
  const listenersRef = useRef(null)
  const trackRef = useRef(null)
  const jobRef = useRef(null)
  // Bumped whenever a newer load, a removal, or unmount supersedes a request.
  const requestRef = useRef(0)
  const onProblemRef = useRef(onProblem)

  useEffect(() => {
    onProblemRef.current = onProblem
  })

  useEffect(
    () => () => {
      requestRef.current += 1
      stopJob(jobRef)
      listenersRef.current?.abort()
      listenersRef.current = null
      if (audioRef.current) releaseAudio(audioRef.current)
      audioRef.current = null
      if (trackRef.current) URL.revokeObjectURL(trackRef.current.url)
      trackRef.current = null
    },
    [],
  )

  function report(notice) {
    onProblemRef.current?.(notice)
  }

  function getAudio() {
    if (audioRef.current) return audioRef.current
    const audio = new Audio()
    audio.preload = 'auto'
    const controller = new AbortController()
    const options = { signal: controller.signal }
    const syncTime = () => setCurrentTime(audio.currentTime)
    audio.addEventListener('play', () => setIsPlaying(true), options)
    audio.addEventListener(
      'pause',
      () => {
        setIsPlaying(false)
        syncTime()
      },
      options,
    )
    audio.addEventListener('ended', syncTime, options)
    audio.addEventListener('timeupdate', syncTime, options)
    audio.addEventListener('seeking', syncTime, options)
    audio.addEventListener('emptied', syncTime, options)
    audio.addEventListener(
      'durationchange',
      () => {
        if (Number.isFinite(audio.duration)) setDuration(audio.duration)
      },
      options,
    )
    audio.addEventListener(
      'error',
      () => {
        if (!audio.getAttribute('src') || !trackRef.current) return
        const name = trackRef.current.name
        remove()
        report({
          kind: 'error',
          title: `Soundtrack “${name}” couldn't be played`,
          message: 'This browser could not play the audio. Try a different MP3 file.',
        })
      },
      options,
    )
    audioRef.current = audio
    listenersRef.current = controller
    return audio
  }

  function startAnalysis(buffer, request) {
    let worker
    try {
      worker = new Worker(new URL('../workers/tempoWorker.js', import.meta.url), {
        type: 'module',
      })
    } catch {
      setAnalysis({
        status: 'failed',
        progress: 0,
        message: 'Tempo analysis is not available in this browser.',
      })
      return
    }

    const job = { worker, timer: null }
    function finish(result) {
      if (jobRef.current !== job || requestRef.current !== request) return
      stopJob(jobRef)
      if (result?.ok) {
        setAnalysis({
          status: 'done',
          progress: 1,
          bpm: result.bpm,
          firstBeat: result.firstBeat,
          confidence: result.confidence,
        })
        setBpmInput((current) => (current === '' ? formatBpm(result.bpm) : current))
      } else {
        setAnalysis({
          status: 'failed',
          progress: 0,
          message: result?.reason ?? 'The tempo could not be measured.',
        })
      }
    }

    job.timer = setTimeout(
      () => finish({ ok: false, reason: 'Tempo analysis took too long.' }),
      ANALYSIS_TIMEOUT_MS,
    )
    worker.onmessage = ({ data }) => {
      if (jobRef.current !== job) return
      if (data.type === 'progress') {
        setAnalysis((current) =>
          current.status === 'analyzing' ? { ...current, progress: data.progress } : current,
        )
      } else {
        finish(data.result)
      }
    }
    worker.onerror = () => finish(null)
    jobRef.current = job
    setAnalysis({ status: 'analyzing', progress: 0 })

    const samples = mixToMono(buffer)
    worker.postMessage({ channels: [samples], sampleRate: buffer.sampleRate }, [
      samples.buffer,
    ])
  }

  // A new file only replaces the current soundtrack once it has decoded, so a
  // broken upload never interrupts the music that is already loaded.
  async function load(file) {
    if (!file) return false
    const problem = validateSoundtrackFile(file)
    if (problem) {
      report({
        kind: 'warning',
        title: `“${file.name}” can't be used as a soundtrack`,
        message: `It was not added because ${problem}. Choose an MP3 file.`,
      })
      return false
    }

    const request = ++requestRef.current
    setPendingName(file.name)
    let buffer = null
    let decodeFailed = false
    try {
      buffer = await decodeAudioFile(file)
    } catch {
      decodeFailed = true
    }
    if (request !== requestRef.current) return false
    setPendingName(null)
    if (decodeFailed) {
      report({
        kind: 'error',
        title: `Soundtrack “${file.name}” couldn't be decoded`,
        message: `The file may be damaged or use an encoding this browser cannot read.${
          trackRef.current ? ' Your previous soundtrack was kept.' : ''
        }`,
      })
      return false
    }

    stopJob(jobRef)
    const audio = getAudio()
    releaseAudio(audio)
    if (trackRef.current) URL.revokeObjectURL(trackRef.current.url)
    const next = { id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file) }
    trackRef.current = next
    audio.src = next.url
    setTrack(next)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(buffer?.duration ?? 0)
    setBpmInput('')
    setOffsetInput('0')
    if (buffer) {
      startAnalysis(buffer, request)
    } else {
      setAnalysis({
        status: 'failed',
        progress: 0,
        message: 'Tempo analysis is not available in this browser.',
      })
    }
    return true
  }

  function remove() {
    requestRef.current += 1
    stopJob(jobRef)
    if (audioRef.current) releaseAudio(audioRef.current)
    if (trackRef.current) URL.revokeObjectURL(trackRef.current.url)
    trackRef.current = null
    setTrack(null)
    setPendingName(null)
    setAnalysis(IDLE_ANALYSIS)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setBpmInput('')
    setOffsetInput('0')
  }

  function play() {
    const audio = audioRef.current
    if (!audio || !trackRef.current) return
    audio.play().catch(() => setIsPlaying(false))
  }

  function pause() {
    audioRef.current?.pause()
  }

  function seek(seconds) {
    const audio = audioRef.current
    if (!audio || !trackRef.current) return
    const limit = duration || (Number.isFinite(audio.duration) ? audio.duration : 0)
    const target = Math.min(Math.max(0, seconds), limit)
    audio.currentTime = target
    setCurrentTime(target)
  }

  const offsetValue = Number(offsetInput)
  const offsetMs = Number.isFinite(offsetValue)
    ? Math.min(MAX_OFFSET_MS, Math.max(-MAX_OFFSET_MS, offsetValue))
    : 0
  const detectedBpm = analysis.status === 'done' ? analysis.bpm : null

  return {
    track,
    pendingName,
    analysis,
    isLowConfidence:
      analysis.status === 'done' && analysis.confidence < LOW_CONFIDENCE,
    detectedBpm,
    bpm: parseBpm(bpmInput),
    bpmInput,
    setBpmInput,
    applyDetectedBpm: () => detectedBpm && setBpmInput(formatBpm(detectedBpm)),
    scaleBpm: (factor) => {
      const bpm = parseBpm(bpmInput)
      if (bpm && parseBpm(bpm * factor)) setBpmInput(formatBpm(bpm * factor))
    },
    firstBeat: analysis.status === 'done' ? analysis.firstBeat : 0,
    offsetMs,
    offsetInput,
    setOffsetInput,
    isPlaying,
    currentTime,
    duration,
    audioRef,
    load,
    remove,
    play,
    pause,
    seek,
  }
}

export default useSoundtrack
