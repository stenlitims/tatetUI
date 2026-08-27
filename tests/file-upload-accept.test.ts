import { describe, expect, it } from 'vitest'
import { isFileAccepted, matchesAccept } from '../app/utils/fileUpload'

const png = new File(['x'], 'photo.png', { type: 'image/png' })
const webp = new File(['x'], 'photo.webp', { type: 'image/webp' })
const pdf = new File(['x'], 'report.pdf', { type: 'application/pdf' })
const pdfUpper = new File(['x'], 'doc.PDF', { type: '' })

describe('matchesAccept', () => {
  it('image/* приймає image/png і відхиляє application/pdf', () => {
    expect(matchesAccept(png, 'image/*')).toBe(true)
    expect(matchesAccept(pdf, 'image/*')).toBe(false)
  })

  it('розширення .pdf приймає file.PDF без урахування регістра', () => {
    expect(matchesAccept(pdfUpper, '.pdf')).toBe(true)
    expect(matchesAccept(pdf, '.pdf')).toBe(true)
  })

  it('точний MIME image/png не приймає image/webp', () => {
    expect(matchesAccept(png, 'image/png')).toBe(true)
    expect(matchesAccept(webp, 'image/png')).toBe(false)
  })

  it('кілька правил через кому (з пробілами) працюють разом', () => {
    expect(matchesAccept(png, 'image/*, .pdf')).toBe(true)
    expect(matchesAccept(pdf, 'image/*, .pdf')).toBe(true)
    expect(matchesAccept(webp, 'image/png, .pdf')).toBe(false)
  })

  it('порожній accept приймає все — контракт на рівні виклику', () => {
    // Компонент викликає isFileAccepted: без accept фільтр не застосовується.
    expect(isFileAccepted(png, undefined)).toBe(true)
    expect(isFileAccepted(pdf, undefined)).toBe(true)
    expect(isFileAccepted(webp, '')).toBe(true)
    expect(isFileAccepted(pdf, '   ')).toBe(true)
    expect(isFileAccepted(pdf, 'image/*')).toBe(false)
  })
})
