import VideoTile from './VideoTile.jsx'

function Workspace({ videos, background }) {
  const style = background
    ? { backgroundImage: `url("${background.url}")` }
    : undefined

  return (
    <main className="workspace" style={style}>
      {videos.length === 0 ? (
        <p className="workspace__empty">
          Upload videos from the panel to start your collage.
        </p>
      ) : (
        <div className="workspace__grid">
          {videos.map((video) => (
            <VideoTile key={video.id} video={video} />
          ))}
        </div>
      )}
    </main>
  )
}

export default Workspace
