import { REVEAL_INTERVAL_OPTIONS } from '../hooks/useRevealMode.js'

function RevealControls({ reveal }) {
  const {
    enabled,
    intervalSeconds,
    visibleCount,
    totalCount,
    isRunning,
    isComplete,
  } = reveal

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

          <div className="reveal-controls__buttons">
            <button
              type="button"
              className="control-panel__button control-panel__button--accent"
              onClick={reveal.start}
              disabled={isRunning || isComplete}
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
              disabled={visibleCount === 0 && !isRunning}
            >
              Reset
            </button>
          </div>

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
