// Ticks for the export draw loop. Worker timers keep their rate when the page
// is hidden or covered, where main-thread timers get slowed to about 1 Hz.
let timer = null

self.onmessage = ({ data }) => {
  clearInterval(timer)
  timer = data.intervalMs > 0 ? setInterval(() => self.postMessage(null), data.intervalMs) : null
}
