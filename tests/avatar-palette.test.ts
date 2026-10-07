import { describe, expect, it } from 'vitest'
import { AVATAR_PALETTE_SIZE, avatarPaletteIndex } from '~/components/ui/UiAvatar.vue'

describe('UiAvatar tone="auto": палітра', () => {
  it('той самий seed завжди дає той самий колір', () => {
    expect(avatarPaletteIndex('01a1166c-9077-711e-99be-58d38e5be6d1')).toBe(avatarPaletteIndex('01a1166c-9077-711e-99be-58d38e5be6d1'))
  })

  it('індекс завжди в межах палітри, навіть для порожнього рядка', () => {
    for (const seed of ['', 'a', 'Олена', '🙂', 'x'.repeat(500)]) {
      const i = avatarPaletteIndex(seed)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(AVATAR_PALETTE_SIZE)
    }
  })

  it('кольори розподіляються: сто різних id не падають в один-два', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 100; i++) seen.add(avatarPaletteIndex(`user-${i}`))
    expect(seen.size).toBeGreaterThanOrEqual(6)
  })
})
