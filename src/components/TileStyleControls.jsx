import { MAX_RADIUS, MIN_OPACITY, normalizeStyle } from '../utils/tileStyle.js'

function TileStyleControls({ item, onChange, onReset }) {
  if (!item) {
    return (
      <p className="control-panel__status">Click a tile to change its style.</p>
    )
  }
  const style = normalizeStyle(item.style)
  const number = (handler) => (event) => handler(Number(event.target.value))

  return (
    <fieldset className="reveal-controls tile-style">
      <legend className="soundtrack-controls__name" title={item.name}>
        Style: {item.name}
      </legend>
      <label className="soundtrack-controls__seek">
        <span>
          Rotation <span className="tile-style__value">{style.rotation}°</span>
        </span>
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={style.rotation}
          onChange={number((rotation) => onChange({ rotation }))}
        />
      </label>
      <label className="soundtrack-controls__seek">
        <span>
          Rounded corners{' '}
          <span className="tile-style__value">{Math.round(style.radius * 100)}%</span>
        </span>
        <input
          type="range"
          min="0"
          max={MAX_RADIUS * 100}
          step="1"
          value={Math.round(style.radius * 100)}
          onChange={number((percent) => onChange({ radius: percent / 100 }))}
        />
      </label>
      <label className="soundtrack-controls__seek">
        <span>
          Opacity <span className="tile-style__value">{Math.round(style.opacity * 100)}%</span>
        </span>
        <input
          type="range"
          min={MIN_OPACITY * 100}
          max="100"
          step="1"
          value={Math.round(style.opacity * 100)}
          onChange={number((percent) => onChange({ opacity: percent / 100 }))}
        />
      </label>
      <label className="reveal-controls__toggle">
        <input
          type="checkbox"
          checked={style.shadow}
          onChange={(event) => onChange({ shadow: event.target.checked })}
        />
        <span>Shadow</span>
      </label>
      <button type="button" className="control-panel__button" onClick={onReset}>
        Reset style
      </button>
    </fieldset>
  )
}

export default TileStyleControls
