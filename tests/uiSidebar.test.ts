import { afterEach, describe, expect, it } from 'vitest'
import { persistCollapsed, readStoredCollapsed } from '~/utils/uiSidebar'

const KEY = 'tatetui-test-sidebar'

afterEach(() => {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // сховище недоступне — прибирати нічого
  }
  document.body.innerHTML = ''
})

describe('uiSidebar storage (UiSidebar collapse persistence)', () => {
  it('readStoredCollapsed: повертає null без ключа', () => {
    expect(readStoredCollapsed(KEY)).toBeNull()
  })

  it('persistCollapsed → readStoredCollapsed: круговий обмін true/false', () => {
    persistCollapsed(KEY, true)
    expect(readStoredCollapsed(KEY)).toBe(true)

    persistCollapsed(KEY, false)
    expect(readStoredCollapsed(KEY)).toBe(false)
  })

  it('readStoredCollapsed: сміття у сховищі читається як null', () => {
    window.localStorage.setItem(KEY, 'yes')
    expect(readStoredCollapsed(KEY)).toBeNull()

    window.localStorage.setItem(KEY, '')
    expect(readStoredCollapsed(KEY)).toBeNull()
  })

  it('persistCollapsed: не кидає при недоступному сховищі', () => {
    const original = window.localStorage
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: private mode')
      },
    })
    try {
      expect(() => persistCollapsed(KEY, true)).not.toThrow()
      expect(readStoredCollapsed(KEY)).toBeNull()
    } finally {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          return original
        },
      })
    }
  })
})