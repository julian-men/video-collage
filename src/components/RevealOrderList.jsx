function RevealOrderList({ items, onMove }) {
  if (items.length < 2) return null
  return (
    <details className="reveal-order">
      <summary>Reveal order</summary>
      <ol className="reveal-order__list">
        {items.map((item, index) => (
          <li key={item.id} className="reveal-order__item">
            <span className="reveal-order__name" title={item.name}>
              {item.name}
            </span>
            <button
              type="button"
              className="control-panel__button soundtrack-controls__small"
              onClick={() => onMove(item.id, -1)}
              disabled={index === 0}
              aria-label={`Move ${item.name} earlier`}
            >
              ↑
            </button>
            <button
              type="button"
              className="control-panel__button soundtrack-controls__small"
              onClick={() => onMove(item.id, 1)}
              disabled={index === items.length - 1}
              aria-label={`Move ${item.name} later`}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
    </details>
  )
}

export default RevealOrderList
