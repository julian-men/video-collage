import { describe, expect, it } from 'vitest'
import { isSoundtrackFile, validateSoundtrackFile } from './audioFiles.js'

const file = (name, type, size = 10) => ({ name, type, size })

describe('validateSoundtrackFile', () => {
  it.each([
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/ogg',
  ])('accepts %s', (type) => {
    expect(validateSoundtrackFile(file('song', type))).toBeNull()
  })

  it.each(['a.mp3', 'a.WAV', 'a.m4a', 'a.aac', 'a.ogg', 'a.oga'])(
    'accepts %s by extension when the type is empty',
    (name) => {
      expect(validateSoundtrackFile(file(name, ''))).toBeNull()
    },
  )

  it('rejects non-audio files', () => {
    expect(validateSoundtrackFile(file('a.mp4', 'video/mp4'))).toBe(
      'it is not a supported audio file',
    )
    expect(validateSoundtrackFile(file('a.txt', ''))).toBe('it is not a supported audio file')
  })

  it('rejects empty files', () => {
    expect(validateSoundtrackFile(file('a.mp3', 'audio/mpeg', 0))).toBe('the file is empty')
  })
})

describe('isSoundtrackFile', () => {
  it('detects audio by type or extension', () => {
    expect(isSoundtrackFile(file('a.ogg', ''))).toBe(true)
    expect(isSoundtrackFile(file('a.png', 'image/png'))).toBe(false)
  })
})
