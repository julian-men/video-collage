import { REVEAL_INTERVAL_OPTIONS } from '../hooks/useRevealMode.js'
import { BEATS_PER_REVEAL_OPTIONS } from '../utils/beatSync.js'

function RevealControls({ reveal, sync, syncEnabled, visibleCount, onToggleSync }) {
  const { enabled, repeat, intervalSeconds, totalCount, isRunning, isComplete } =
    reveal
  const synced = sync.isActive

  let syncHint = null
  if (syncEnabled && !synced) {
    syncHint = 'Add a soundtrack and a valid BPM to sync. Using the timer until then.'
  } else if (synced) {
    syncHint =
      'Reveals follow the music. Nothing shows before the first beat; → / N are off while synced.'
  }

  return (
    <fieldset className="reveal-controls">
      <label className="reveal-controls__toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => reveal.setEnabled(event.target.checked)}
        />
        <span>Reveal mode</span>
      </label>

      {enabled && (
        <>
          <label className="reveal-controls__toggle">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(event) => onToggleSync(event.target.checked)}
              aria-describedby={syncHint ? 'sync-reveal-hint' : undefined}
            />
            <span>Sync reveal to music</span>
          </label>
          {syncHint && (
            <p id="sync-reveal-hint" className="soundtrack-controls__hint">
              {syncHint}
            </p>
          )}

          {synced ? (
            <label className="reveal-controls__interval">
              <span>Reveal every</span>
              <select
                value={sync.beatsPerReveal}
                onChange={(event) => sync.setBeatsPerReveal(Number(event.target.value))}
              >
                {BEATS_PER_REVEAL_OPTIONS.map((beats) => (
                  <option key={beats} value={beats}>
                    {beats} beat{beats === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="reveal-controls__interval">
              <span>Reveal every</span>
              <select
                value={intervalSeconds}
                onChange={(event) =>
                  reveal.setIntervalSeconds(Number(event.target.value))
                }
              >
                {REVEAL_INTERVAL_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds} second{seconds === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="reveal-controls__toggle">
            <input
              type="checkbox"
              checked={repeat}
              onChange={(event) => reveal.setRepeat(event.target.checked)}
            />
            <span>Repeat reveal</span>
          </label>

          {synced ? (
            <div className="reveal-controls__buttons">
              <button
                type="button"
                className="control-panel__button control-panel__button--accent"
                onClick={sync.start}
                disabled={sync.isPlaying}
              >
                Start
              </button>
              <button
                type="button"
                className="control-panel__button"
                onClick={sync.pause}
                disabled={!sync.isPlaying}
              >
                Pause
              </button>
              <button
                type="button"
                className="control-panel__button"
                onClick={sync.reset}
              >
                Reset
              </button>
            </div>
          ) : (
            <div className="reveal-controls__buttons">
              <button
                type="button"
                className="control-panel__button control-panel__button--accent"
                onClick={reveal.start}
                disabled={isRunning || totalCount === 0 || (isComplete && !repeat)}
              >
                Start
              </button>
              <button
                type="button"
                className="control-panel__button"
                onClick={reveal.pause}
                disabled={!isRunning}
              >
                Pause
              </button>
              <button
                type="button"
                className="control-panel__button"
                onClick={reveal.reset}
                disabled={reveal.visibleCount === 0 && !isRunning}
              >
                Reset
              </button>
            </div>
          )}

          <p className="reveal-controls__progress">
            {visibleCount} of {totalCount} media item
            {totalCount === 1 ? '' : 's'} revealed
          </p>
        </>
      )}
    </fieldset>
  )
}

export default RevealControls
