import RevealControls from './RevealControls.jsx'

function ControlPanel({
  itemCount,
  hasBackground,
  reveal,
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

  const isEmpty = itemCount === 0 && !hasBackground

  let exportHint = 'Record a 5-second WebM of the collage'
  if (reveal.enabled) exportHint = 'Turn off Reveal mode to export'
  else if (itemCount === 0) exportHint = 'Add media to export'

  return (
    <aside className="control-panel">
      <h1 className="control-panel__title">Video Collage</h1>

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

      <button
        type="button"
        className="control-panel__button"
        onClick={onRandomizeLayout}
        disabled={itemCount === 0}
      >
        Randomize layout
      </button>

      <RevealControls reveal={reveal} />

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
      </p>

      <p className="control-panel__status">
        Press <kbd>?</kbd> for keyboard shortcuts
      </p>
    </aside>
  )
}

export default ControlPanel
