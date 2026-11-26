import { describe, expect, it } from 'vitest'
import { PROJECT_VERSION, fromRecord, toRecord } from './projectRecord.js'
import { DEFAULT_TILE_STYLE } from './tileStyle.js'

const blobA = new Blob(['a'])
const blobBg = new Blob(['bg'])
const blobSong = new Blob(['song'])
const item = {
  id: 'a',
  name: 'a.png',
  url: 'blob:a',
  blob: blobA,
  type: 'image',
  x: 0.5,
  y: 0.25,
  width: 300,
  aspectRatio: 1.5,
  zIndex: 2,
  style: { ...DEFAULT_TILE_STYLE, rotation: 15 },
}

describe('toRecord', () => {
  it('keeps layout in the record and files in a separate map', () => {
    const { meta, files } = toRecord({
      items: [item, { ...item, id: 'broken', loadError: 'nope', blob: blobA }],
      background: { id: 'bg', name: 'bg.png', url: 'blob:bg', blob: blobBg },
      soundtrack: { id: 's', name: 'song.mp3', file: blobSong, bpmInput: '120', offsetInput: '-20' },
      settings: { exportFrame: 'square' },
    })
    expect(meta.version).toBe(PROJECT_VERSION)
    expect(meta.items).toHaveLength(2)
    expect(meta.items[1]).not.toHaveProperty('loadError')
    expect(meta.items.slice(0, 1)).toEqual([
      {
        id: 'a',
        name: 'a.png',
        type: 'image',
        x: 0.5,
        y: 0.25,
        width: 300,
        aspectRatio: 1.5,
        zIndex: 2,
        style: item.style,
      },
    ])
    expect(meta.background).toEqual({ id: 'bg', name: 'bg.png' })
    expect(meta.soundtrack).toEqual({ id: 's', name: 'song.mp3', bpmInput: '120', offsetInput: '-20' })
    expect(meta.settings).toEqual({ exportFrame: 'square' })
    expect([...files.keys()]).toEqual(['a', 'broken', 'bg', 's'])
    expect(files.get('a')).toBe(blobA)
  })
})

describe('fromRecord', () => {
  const { meta, files } = toRecord({
    items: [item],
    background: { id: 'bg', name: 'bg.png', blob: blobBg },
    soundtrack: { id: 's', name: 'song.mp3', file: blobSong, bpmInput: '', offsetInput: '0' },
    settings: { syncEnabled: true },
  })

  it('round-trips a project', () => {
    const project = fromRecord(meta, files)
    expect(project.items).toEqual([{ ...meta.items[0], blob: blobA }])
    expect(project.background).toEqual({ name: 'bg.png', blob: blobBg })
    expect(project.soundtrack).toEqual({ name: 'song.mp3', blob: blobSong, bpmInput: '', offsetInput: '0' })
    expect(project.settings).toEqual({ syncEnabled: true })
  })

  it('drops anything whose file is missing', () => {
    const project = fromRecord(meta, new Map())
    expect(project.items).toEqual([])
    expect(project.background).toBeNull()
    expect(project.soundtrack).toBeNull()
  })

  it('repairs missing or invalid fields', () => {
    const broken = { ...meta, items: [{ id: 'a', name: 'a.png', type: 'image', x: 'no' }] }
    const [restored] = fromRecord(broken, files).items
    expect(restored.style).toEqual(DEFAULT_TILE_STYLE)
    expect(restored.x).toBe(0.5)
    expect(restored.width).toBeGreaterThan(0)
    expect(restored.aspectRatio).toBeGreaterThan(0)
  })

  it('ignores records from another version or nothing at all', () => {
    expect(fromRecord(null, files)).toBeNull()
    expect(fromRecord({ ...meta, version: 99 }, files)).toBeNull()
  })
})
