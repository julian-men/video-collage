import { describe, expect, it } from 'vitest'
import { validateBackgroundFile, validateMediaFile } from './mediaFiles.js'

const file = (name, type, size = 10) => ({ name, type, size })

describe('validateMediaFile', () => {
  it('sorts files into videos and images by type or extension', () => {
    expect(validateMediaFile(file('a.mov', 'video/quicktime'))).toEqual({ type: 'video' })
    expect(validateMediaFile(file('a.webp', 'image/webp'))).toEqual({ type: 'image' })
    expect(validateMediaFile(file('a.MP4', ''))).toEqual({ type: 'video' })
    expect(validateMediaFile(file('a.jpeg', ''))).toEqual({ type: 'image' })
  })

  it('explains why a file was rejected', () => {
    expect(validateMediaFile(file('a.svg', 'image/svg+xml'))).toEqual({ reason: 'unsupported file type' })
    expect(validateMediaFile(file('a.png', 'image/png', 0))).toEqual({ reason: 'the file is empty' })
  })
})

describe('validateBackgroundFile', () => {
  it('only accepts non-empty images', () => {
    expect(validateBackgroundFile(file('a.png', 'image/png'))).toBeNull()
    expect(validateBackgroundFile(file('a.mp4', 'video/mp4'))).toBe('it is not an image file')
  })
})
