import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useReducedMotion } from '~/composables/useReducedMotion'

describe('useReducedMotion', () => {
  it('читає системний preference, реагує на change та чистить listener', () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined
    const remove = vi.fn()
    const query = {
      matches: true,
      addEventListener: vi.fn((_type: string, callback: (event: MediaQueryListEvent) => void) => {
        listener = callback
      }),
      removeEventListener: remove,
    }
    const original = window.matchMedia
    window.matchMedia = vi.fn(() => query as unknown as MediaQueryList)
    const scope = effectScope()
    const reduced = scope.run(useReducedMotion)!

    expect(reduced.value).toBe(true)
    listener?.({ matches: false } as MediaQueryListEvent)
    expect(reduced.value).toBe(false)
    scope.stop()
    expect(remove).toHaveBeenCalledWith('change', listener)
    window.matchMedia = original
  })
})
