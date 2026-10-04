function ControlPanel({
  videoCount,
  hasBackground,
  onAddVideos,
  onSetBackground,
  onClearAll,
}) {
  function handleVideoChange(event) {
    onAddVideos(Array.from(event.target.files))
    // Reset so selecting the same file again still fires a change event.
    event.target.value = ''
  }

  function handleBackgroundChange(event) {
    onSetBackground(event.target.files[0])
    event.target.value = ''
  }

  const isEmpty = videoCount === 0 && !hasBackground

  return (
    <aside className="control-panel">
      <h1 className="control-panel__title">Video Collage</h1>

      <label className="control-panel__field">
        <span>Videos</span>
        <input
          type="file"
          accept="video/*"
          multiple
          onChange={handleVideoChange}
        />
      </label>

      <label className="control-panel__field">
        <span>Background image</span>
        <input type="file" accept="image/*" onChange={handleBackgroundChange} />
      </label>

      <button
        type="button"
        className="control-panel__clear"
        onClick={onClearAll}
        disabled={isEmpty}
      >
        Clear all media
      </button>

      <p className="control-panel__status">
        {videoCount} video{videoCount === 1 ? '' : 's'}
        {hasBackground ? ' · background set' : ''}
      </p>
    </aside>
  )
}

export default ControlPanel
