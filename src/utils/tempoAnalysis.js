// Beat tracking for a steady-tempo soundtrack. Everything here is plain math on
// Float32Arrays so it can run inside a Web Worker (and be tested in Node).

export const MIN_DETECT_BPM = 60
export const MAX_DETECT_BPM = 200
export const LOW_CONFIDENCE = 0.3

const ENVELOPE_RATE = 200 // onset envelope frames per second
const MIN_DURATION_SECONDS = 4
const LOCAL_MEAN_SECONDS = 0.25
const SMOOTH_RADIUS = 4
const SMOOTH_SIGMA = 1.5
const PRIOR_CENTER_BPM = 120
const MAX_HARMONICS = 8

function mixToMono(channels) {
  if (channels.length === 1) return channels[0]
  const length = Math.min(...channels.map((channel) => channel.length))
  const mono = new Float32Array(length)
  for (const channel of channels) {
    for (let i = 0; i < length; i += 1) mono[i] += channel[i]
  }
  for (let i = 0; i < length; i += 1) mono[i] /= channels.length
  return mono
}

// Half-wave rectified log-energy rise per frame, with the local average removed
// so sustained loud passages don't swamp the actual note onsets.
function onsetEnvelope(samples, sampleRate, onProgress) {
  const hop = sampleRate / ENVELOPE_RATE
  const frames = Math.floor(samples.length / hop)
  const energy = new Float32Array(frames)
  let peakEnergy = 0
  for (let frame = 0; frame < frames; frame += 1) {
    const start = Math.round(frame * hop)
    const end = Math.min(samples.length, Math.round((frame + 1) * hop))
    let sum = 0
    for (let i = start; i < end; i += 1) sum += samples[i] * samples[i]
    energy[frame] = sum / Math.max(1, end - start)
    if (energy[frame] > peakEnergy) peakEnergy = energy[frame]
    if (frame % 20000 === 0) onProgress?.((frame / frames) * 0.5)
  }
  if (peakEnergy < 1e-8) return null

  const flux = new Float32Array(frames)
  const scale = 1000 / peakEnergy
  let previous = Math.log1p(energy[0] * scale)
  for (let frame = 1; frame < frames; frame += 1) {
    const current = Math.log1p(energy[frame] * scale)
    flux[frame] = Math.max(0, current - previous)
    previous = current
  }

  const radius = Math.round(LOCAL_MEAN_SECONDS * ENVELOPE_RATE)
  const prefix = new Float64Array(frames + 1)
  for (let i = 0; i < frames; i += 1) prefix[i + 1] = prefix[i] + flux[i]
  const rectified = new Float32Array(frames)
  for (let i = 0; i < frames; i += 1) {
    const lo = Math.max(0, i - radius)
    const hi = Math.min(frames, i + radius + 1)
    const mean = (prefix[hi] - prefix[lo]) / (hi - lo)
    rectified[i] = Math.max(0, flux[i] - mean)
  }

  const kernel = []
  for (let k = -SMOOTH_RADIUS; k <= SMOOTH_RADIUS; k += 1) {
    kernel.push(Math.exp(-(k * k) / (2 * SMOOTH_SIGMA * SMOOTH_SIGMA)))
  }
  const kernelSum = kernel.reduce((a, b) => a + b, 0)
  const envelope = new Float32Array(frames)
  for (let i = 0; i < frames; i += 1) {
    let sum = 0
    for (let k = -SMOOTH_RADIUS; k <= SMOOTH_RADIUS; k += 1) {
      const j = i + k
      if (j >= 0 && j < frames) sum += rectified[j] * kernel[k + SMOOTH_RADIUS]
    }
    envelope[i] = sum / kernelSum
  }
  return envelope
}

function createAutocorrelation(envelope) {
  const length = envelope.length
  let mean = 0
  for (let i = 0; i < length; i += 1) mean += envelope[i]
  mean /= length
  const centered = new Float32Array(length)
  for (let i = 0; i < length; i += 1) centered[i] = envelope[i] - mean
  const cache = new Map()

  function atLag(lag) {
    if (lag < 0 || lag >= length - 1) return 0
    let value = cache.get(lag)
    if (value === undefined) {
      let sum = 0
      for (let i = 0; i + lag < length; i += 1) sum += centered[i] * centered[i + lag]
      value = sum / (length - lag)
      cache.set(lag, value)
    }
    return value
  }

  function interpolated(lag) {
    const low = Math.floor(lag)
    const fraction = lag - low
    return atLag(low) * (1 - fraction) + atLag(low + 1) * fraction
  }

  return { atLag, interpolated, energy: atLag(0) }
}

function bpmPrior(bpm) {
  const octaves = Math.log2(bpm / PRIOR_CENTER_BPM)
  return Math.exp(-0.5 * octaves * octaves)
}

function harmonicScore(acf, period, harmonics) {
  let sum = 0
  for (let k = 1; k <= harmonics; k += 1) sum += acf.interpolated(k * period)
  return sum / harmonics
}

function linearFit(points) {
  const n = points.length
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (const [x, y] of points) {
    sx += x
    sy += y
    sxx += x * x
    sxy += x * y
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)
  return { slope, intercept: (sy - slope * sx) / n }
}

// Finds the strongest envelope peak near each predicted beat.
function beatPeaks(envelope, phase, period) {
  const window = period * 0.2
  const peaks = []
  for (let beat = 0; phase + beat * period < envelope.length; beat += 1) {
    const center = phase + beat * period
    const lo = Math.max(1, Math.round(center - window))
    const hi = Math.min(envelope.length - 2, Math.round(center + window))
    let best = -1
    for (let i = lo; i <= hi; i += 1) {
      if (best === -1 || envelope[i] > envelope[best]) best = i
    }
    if (best === -1) continue
    const left = envelope[best - 1]
    const mid = envelope[best]
    const right = envelope[best + 1]
    const curvature = left - 2 * mid + right
    const shift = curvature < 0 ? (0.5 * (left - right)) / curvature : 0
    peaks.push({ beat, position: best + shift, strength: mid })
  }
  return peaks
}

/**
 * Estimates a steady tempo and the time of the first beat.
 * Returns { ok: true, bpm, firstBeat, confidence } or { ok: false, reason }.
 */
export function analyzeTempo(channels, sampleRate, onProgress) {
  const samples = mixToMono(channels)
  if (samples.length / sampleRate < MIN_DURATION_SECONDS) {
    return { ok: false, reason: 'The soundtrack is too short to measure a tempo.' }
  }

  const envelope = onsetEnvelope(samples, sampleRate, onProgress)
  if (!envelope) return { ok: false, reason: 'The soundtrack appears to be silent.' }
  onProgress?.(0.5)

  const acf = createAutocorrelation(envelope)
  if (acf.energy <= 0) return { ok: false, reason: 'No clear beats were found.' }

  const minLag = Math.ceil((ENVELOPE_RATE * 60) / MAX_DETECT_BPM)
  const maxLag = Math.floor((ENVELOPE_RATE * 60) / MIN_DETECT_BPM)
  let coarseLag = minLag
  let coarseScore = -Infinity
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    const score = acf.atLag(lag) * bpmPrior((ENVELOPE_RATE * 60) / lag)
    if (score > coarseScore) {
      coarseScore = score
      coarseLag = lag
    }
  }
  onProgress?.(0.7)

  const harmonics = Math.max(
    1,
    Math.min(MAX_HARMONICS, Math.floor(envelope.length / 2 / coarseLag)),
  )
  let period = coarseLag
  let periodScore = -Infinity
  for (let candidate = coarseLag - 1; candidate <= coarseLag + 1; candidate += 0.01) {
    const score = harmonicScore(acf, candidate, harmonics)
    if (score > periodScore) {
      periodScore = score
      period = candidate
    }
  }
  onProgress?.(0.85)

  let phase = 0
  let phaseScore = -Infinity
  for (let candidate = 0; candidate < period; candidate += 0.25) {
    let sum = 0
    for (let position = candidate; position < envelope.length - 1; position += period) {
      const low = Math.floor(position)
      const fraction = position - low
      sum += envelope[low] * (1 - fraction) + envelope[low + 1] * fraction
    }
    if (sum > phaseScore) {
      phaseScore = sum
      phase = candidate
    }
  }

  // Refine tempo and phase with a least-squares line through the beat peaks,
  // dropping weak or off-grid peaks on the second pass.
  let peaks = beatPeaks(envelope, phase, period)
  const strengths = peaks.map((peak) => peak.strength).sort((a, b) => a - b)
  const threshold = 0.5 * (strengths[Math.floor(strengths.length / 2)] ?? 0)
  peaks = peaks.filter((peak) => peak.strength > threshold && peak.strength > 0)
  if (peaks.length < 4) return { ok: false, reason: 'No clear beats were found.' }

  let fit = linearFit(peaks.map((peak) => [peak.beat, peak.position]))
  const steady = peaks.filter(
    (peak) =>
      Math.abs(fit.intercept + fit.slope * peak.beat - peak.position) < period * 0.08,
  )
  if (steady.length >= 4) {
    fit = linearFit(steady.map((peak) => [peak.beat, peak.position]))
    peaks = steady
  }
  onProgress?.(0.95)

  const bpm = (ENVELOPE_RATE * 60) / fit.slope
  if (!Number.isFinite(bpm) || bpm < MIN_DETECT_BPM / 1.1 || bpm > MAX_DETECT_BPM * 1.1) {
    return { ok: false, reason: 'No steady tempo was found.' }
  }

  // The first beat is the earliest strong peak, so a silent intro is skipped.
  const firstBeatFrame = fit.intercept + fit.slope * peaks[0].beat
  const firstBeat = Math.max(0, (firstBeatFrame + 0.5) / ENVELOPE_RATE)

  const confidence = Math.max(
    0,
    Math.min(1, harmonicScore(acf, fit.slope, Math.min(4, harmonics)) / acf.energy),
  )
  onProgress?.(1)
  return { ok: true, bpm, firstBeat, confidence }
}
