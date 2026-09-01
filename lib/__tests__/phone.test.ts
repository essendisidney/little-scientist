import { describe, expect, it } from 'vitest'
import { isValidKenyaPhone, normalizeKenyaPhone } from '@/lib/phone'

describe('normalizeKenyaPhone', () => {
  it('normalizes 07 local format', () => {
    expect(normalizeKenyaPhone('0712345678')).toBe('254712345678')
  })

  it('accepts 254 format', () => {
    expect(normalizeKenyaPhone('254712345678')).toBe('254712345678')
  })

  it('rejects invalid numbers', () => {
    expect(() => normalizeKenyaPhone('12345')).toThrow()
  })
})

describe('isValidKenyaPhone', () => {
  it('returns true for valid numbers', () => {
    expect(isValidKenyaPhone('0700 101 425')).toBe(true)
  })

  it('returns false for invalid numbers', () => {
    expect(isValidKenyaPhone('not-a-phone')).toBe(false)
  })
})
