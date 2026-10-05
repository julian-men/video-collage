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
