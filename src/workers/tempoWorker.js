import { analyzeTempo } from '../utils/tempoAnalysis.js'

const PROGRESS_STEP = 0.05

self.onmessage = (event) => {
  const { channels, sampleRate } = event.data
  let lastReported = -1
  try {
    const result = analyzeTempo(channels, sampleRate, (progress) => {
      if (progress - lastReported < PROGRESS_STEP) return
      lastReported = progress
      self.postMessage({ type: 'progress', progress })
    })
    self.postMessage({ type: 'result', result })
  } catch {
    self.postMessage({ type: 'result', result: { ok: false } })
  }
}
