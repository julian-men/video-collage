import { APP_NAME } from '../appInfo.js'
import RevealControls from './RevealControls.jsx'
import SoundtrackControls from './SoundtrackControls.jsx'

function ControlPanel({
  itemCount,
  hasBackground,
  reveal,
  sync,
  syncEnabled,
  visibleCount,
  onToggleSync,
  soundtrack,
  onLoadSoundtrack,
  onRemoveSoundtrack,
  mediaAccept,
  onAddMedia,
  onSetBackground,
  onRandomizeLayout,
  onEnterPresentation,
  isExporting,
  exportError,
  onExport,
  onClearAll,
}) {
  function handleMediaChange(event) {
    onAddMedia(Array.from(event.target.files))
    // Reset so selecting the same file again still fires a change event.
    event.target.value = ''
  }

  function handleBackgroundChange(event) {
    onSetBackground(event.target.files[0])
    event.target.value = ''
  }

  const hasSoundtrack = soundtrack.track !== null || soundtrack.pendingName !== null
  const isEmpty = itemCount === 0 && !hasBackground && !hasSoundtrack

  let exportHint = 'Record a 5-second WebM of the collage'
  if (reveal.enabled) exportHint = 'Turn off Reveal mode to export'
  else if (itemCount === 0) exportHint = 'Add media to export'

  return (
    <aside className="control-panel">
      <h1 className="control-panel__title">{APP_NAME}</h1>

      <label className="control-panel__field">
        <span>Videos &amp; images</span>
        <input
          type="file"
          accept={mediaAccept}
          multiple
          onChange={handleMediaChange}
        />
      </label>

      <label className="control-panel__field">
        <span>Background image</span>
        <input type="file" accept="image/*" onChange={handleBackgroundChange} />
      </label>

      <SoundtrackControls
        soundtrack={soundtrack}
        onLoad={onLoadSoundtrack}
        onRemove={onRemoveSoundtrack}
        onPlay={sync.start}
        onPause={sync.pause}
        onSeek={sync.seek}
      />

      <button
        type="button"
        className="control-panel__button"
        onClick={onRandomizeLayout}
        disabled={itemCount === 0}
      >
        Randomize layout
      </button>

      <RevealControls
        reveal={reveal}
        sync={sync}
        syncEnabled={syncEnabled}
        visibleCount={visibleCount}
        onToggleSync={onToggleSync}
      />

      <button
        type="button"
        className="control-panel__button control-panel__button--accent"
        onClick={onEnterPresentation}
      >
        Enter presentation mode
      </button>

      <button
        type="button"
        className="control-panel__button"
        onClick={onExport}
        disabled={isExporting || reveal.enabled || itemCount === 0}
        title={exportHint}
        aria-busy={isExporting}
      >
        {isExporting ? 'Exporting…' : 'Export WebM'}
      </button>

      {exportError && (
        <p className="control-panel__error" role="alert">
          {exportError}
        </p>
      )}

      <button
        type="button"
        className="control-panel__button control-panel__button--danger"
        onClick={onClearAll}
        disabled={isEmpty}
      >
        Clear all media
      </button>

      <p className="control-panel__status">
        {itemCount} media item{itemCount === 1 ? '' : 's'}
        {hasBackground ? ' · background set' : ''}
        {soundtrack.track ? ' · soundtrack set' : ''}
      </p>

      <p className="control-panel__status">
        Press <kbd>?</kbd> for keyboard shortcuts
      </p>
    </aside>
  )
}

export default ControlPanel
