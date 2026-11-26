/**
 * How many items to show after undo or redo adds or removes items, so the
 * items that were shown stay shown and nothing hidden pops into view. Shows
 * everything up to the last previously shown item that still exists, which
 * includes restored items in between. Same items in any order: unchanged.
 */
export function revealCountAfterChange(before, after, count) {
  const beforeIds = new Set(before.map((item) => item.id))
  const sameItems =
    before.length === after.length && after.every((item) => beforeIds.has(item.id))
  if (sameItems) return count
  const position = new Map(after.map((item, index) => [item.id, index]))
  let last = -1
  for (const item of before.slice(0, count)) {
    last = Math.max(last, position.get(item.id) ?? -1)
  }
  return last + 1
}
