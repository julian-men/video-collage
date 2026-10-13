// Converts an item's stored width and 0–1 position into pixels, shrinking it
// (without changing its aspect ratio) if it would not fit the workspace.
export function getTileRect(item, workspace) {
  const width = Math.max(
    0,
    Math.min(item.width, workspace.width, workspace.height * item.aspectRatio),
  )
  const height = width / item.aspectRatio
  const maxLeft = Math.max(0, workspace.width - width)
  const maxTop = Math.max(0, workspace.height - height)
  return {
    width,
    left: item.x * maxLeft,
    top: item.y * maxTop,
    maxLeft,
    maxTop,
    workspaceWidth: workspace.width,
    workspaceHeight: workspace.height,
  }
}
