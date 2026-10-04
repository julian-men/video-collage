function VideoTile({ video, rect, onMetadata }) {
  function handleLoadedMetadata(event) {
    const { videoWidth, videoHeight } = event.currentTarget
    if (videoWidth > 0 && videoHeight > 0) {
      onMetadata(video.id, videoWidth / videoHeight)
    }
  }

  return (
    <figure
      className="video-tile"
      style={{ width: rect.width, left: rect.left, top: rect.top }}
    >
      <video
        className="video-tile__video"
        src={video.url}
        style={{ aspectRatio: video.aspectRatio }}
        autoPlay
        muted
        loop
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
      />
      <figcaption className="video-tile__caption">{video.name}</figcaption>
    </figure>
  )
}

export default VideoTile
