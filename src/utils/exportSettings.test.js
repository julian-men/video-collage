import { describe, expect, it } from 'vitest'
import { EXPORT_FRAMES, exportFrameLayout } from './exportSettings.js'

describe('exportFrameLayout', () => {
  it('matches the workspace shape by default', () => {
    const layout = exportFrameLayout(1400, 900, 'workspace', 'high')
    expect(layout).toMatchObject({ width: 1680, height: 1080, offsetX: 0, offsetY: 0 })
    expect(layout.scale).toBeCloseTo(1.2)
  })

  it('makes a full-size portrait frame and letterboxes a landscape workspace', () => {
    const layout = exportFrameLayout(1400, 900, 'portrait', 'high')
    expect(layout).toMatchObject({ width: 1080, height: 1920, offsetX: 0 })
    expect(layout.offsetY).toBeGreaterThan(0)
    expect(layout.offsetY * 2 + 900 * layout.scale).toBeCloseTo(1920)
  })

  it('makes a square frame from the short side', () => {
    expect(exportFrameLayout(1400, 900, 'square', 'standard')).toMatchObject({
      width: 720,
      height: 720,
    })
  })

  it('uses portrait bounds for a portrait workspace', () => {
    expect(exportFrameLayout(900, 1400, 'workspace', 'high')).toMatchObject({
      width: 1080,
      height: 1680,
    })
  })

  it('always produces even sizes', () => {
    for (const frame of Object.keys(EXPORT_FRAMES)) {
      const { width, height } = exportFrameLayout(1333, 777, frame, 'high')
      expect(width % 2).toBe(0)
      expect(height % 2).toBe(0)
    }
  })
})
