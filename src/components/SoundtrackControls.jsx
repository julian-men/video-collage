import { MAX_OFFSET_MS } from '../hooks/useSoundtrack.js'
import { SOUNDTRACK_ACCEPT } from '../utils/audioFiles.js'
import { MAX_BPM, MIN_BPM } from '../utils/beatSync.js'

function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

function SoundtrackControls({ soundtrack, onLoad, onRemove, onPlay, onPause, onSeek }) {
  const {
    track,
    pendingName,
    analysis,
    isLowConfidence,
    detectedBpm,
    bpm,
    bpmInput,
    offsetInput,
    isPlaying,
    currentTime,
    duration,
  } = soundtrack

  function handleFileChange(event) {
    onLoad(event.target.files[0])
    event.target.value = ''
  }

  const bpmInvalid = bpmInput !== '' && bpm === null
  const bpmHintId = 'soundtrack-bpm-hint'
  const offsetHintId = 'soundtrack-offset-hint'

  return (
    <fieldset className="reveal-controls soundtrack-controls">
      <label className="control-panel__field">
        <span>Soundtrack (MP3)</span>
        <input type="file" accept={SOUNDTRACK_ACCEPT} onChange={handleFileChange} />
      </label>

      {pendingName && (
        <p className="reveal-controls__progress" role="status">
          Checking “{pendingName}”…
        </p>
      )}

      {track && (
        <>
          <p className="soundtrack-controls__name" title={track.name}>
            {track.name}
          </p>

          <div className="soundtrack-controls__transport">
            <button
              type="button"
              className="control-panel__button control-panel__button--accent"
              onClick={isPlaying ? onPause : onPlay}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              className="control-panel__button control-panel__button--danger"
              onClick={onRemove}
            >
              Remove soundtrack
            </button>
          </div>

          <label className="soundtrack-controls__seek">
            <span className="soundtrack-controls__time" aria-hidden="true">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.01"
              value={Math.min(currentTime, duration || 0)}
              disabled={!duration}
              aria-label="Soundtrack position"
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
              onChange={(event) => onSeek(Number(event.target.value))}
            />
          </label>

          <div className="soundtrack-controls__analysis" aria-live="polite">
            {analysis.status === 'analyzing' && (
              <>
                <span>Analyzing tempo… {Math.round(analysis.progress * 100)}%</span>
                <progress
                  max="1"
                  value={analysis.progress}
                  aria-label="Tempo analysis progress"
                />
              </>
            )}
            {analysis.status === 'done' && (
              <span>
                Estimated tempo: <strong>{detectedBpm.toFixed(1)} BPM</strong>
                {isLowConfidence
                  ? ' — please check the BPM below if it seems off.'
                  : ''}
              </span>
            )}
            {analysis.status === 'failed' && (
              <span className="soundtrack-controls__warning">
                {analysis.message} Enter the BPM manually to sync.
              </span>
            )}
          </div>

          <div className="soundtrack-controls__row">
            <label className="soundtrack-controls__number">
              <span>BPM</span>
              <input
                type="number"
                inputMode="decimal"
                min={MIN_BPM}
                max={MAX_BPM}
                step="0.1"
                value={bpmInput}
                placeholder="e.g. 120"
                aria-invalid={bpmInvalid}
                aria-describedby={bpmHintId}
                onChange={(event) => soundtrack.setBpmInput(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="control-panel__button soundtrack-controls__small"
              onClick={() => soundtrack.scaleBpm(0.5)}
              disabled={bpm === null}
              aria-label="Halve BPM"
            >
              ½×
            </button>
            <button
              type="button"
              className="control-panel__button soundtrack-controls__small"
              onClick={() => soundtrack.scaleBpm(2)}
              disabled={bpm === null}
              aria-label="Double BPM"
            >
              2×
            </button>
          </div>
          <p id={bpmHintId} className="soundtrack-controls__hint">
            {bpmInvalid
              ? `Enter a BPM between ${MIN_BPM} and ${MAX_BPM}.`
              : 'Detection is approximate. Correct it here if reveals feel off.'}
            {detectedBpm !== null && bpm !== null && Math.abs(bpm - detectedBpm) > 0.05 && (
              <>
                {' '}
                <button
                  type="button"
                  className="soundtrack-controls__link"
                  onClick={soundtrack.applyDetectedBpm}
                >
                  Use detected ({detectedBpm.toFixed(1)})
                </button>
              </>
            )}
          </p>

          <label className="soundtrack-controls__number">
            <span>Beat offset (ms)</span>
            <input
              type="number"
              min={-MAX_OFFSET_MS}
              max={MAX_OFFSET_MS}
              step="10"
              value={offsetInput}
              aria-describedby={offsetHintId}
              onChange={(event) => soundtrack.setOffsetInput(event.target.value)}
            />
          </label>
          <p id={offsetHintId} className="soundtrack-controls__hint">
            Positive values make reveals happen later; negative values make them
            earlier.
          </p>
        </>
      )}
    </fieldset>
  )
}

export default SoundtrackControls
