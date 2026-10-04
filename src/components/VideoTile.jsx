function VideoTile({ video }) {
  return (
    <figure className="video-tile">
      <video
        className="video-tile__video"
        src={video.url}
        autoPlay
        muted
        loop
        playsInline
      />
      <figcaption className="video-tile__caption">{video.name}</figcaption>
    </figure>
  )
}

export default VideoTile
