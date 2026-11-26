// Items are revealed in array order. Moves `id` by `delta` places, returning
// the same array when it can't move.
export function moveItem(items, id, delta) {
  const from = items.findIndex((item) => item.id === id)
  const to = from + delta
  if (from === -1 || to < 0 || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
