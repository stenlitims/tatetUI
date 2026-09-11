import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountComponent } from './helpers/mountComponent'

/**
 * Стан useConfirm — синглтон на рівні модуля, тож кожен тест бере свіжий
 * модуль: відкритий діалог одного тесту інакше тік би в наступний.
 */
async function loadConfirm() {
  vi.resetModules()
  const mod = await import('~/composables/useConfirm')
  return mod.useConfirm()
}

/** Чи зарезолвився проміс — без гонок із мікрозадачами. */
function track<T>(promise: Promise<T>) {
  const state = { settled: false, value: undefined as T | undefined }
  void promise.then((value) => {
    state.settled = true
    state.value = value
  })
  return state
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('useConfirm', () => {
  let api: Awaited<ReturnType<typeof loadConfirm>>

  beforeEach(async () => {
    api = await loadConfirm()
  })

  it('відкриває діалог і НЕ резолвиться, поки користувач не відповів', async () => {
    const state = track(api.confirm('Видалити?'))
    await flush()

    expect(api._state.isOpen.value).toBe(true)
    expect(state.settled).toBe(false)
  })

  it('підтвердження віддає true, скасування — false', async () => {
    const accepted = track(api.confirm('Видалити?'))
    api._accept()
    await flush()
    expect(accepted.value).toBe(true)
    expect(api._state.isOpen.value).toBe(false)

    const cancelled = track(api.confirm('Видалити?'))
    api._cancel()
    await flush()
    expect(cancelled.value).toBe(false)
  })

  it('alert — одна кнопка, без скасування', async () => {
    const state = track(api.alert('Готово'))
    await flush()
    expect(api._state.options.value).toMatchObject({ hideCancel: true, confirmText: 'Зрозуміло' })

    api._accept()
    await flush()
    expect(state.value).toBe(true)
  })

  it('prompt віддає введене значення, а на скасуванні — null', async () => {
    const entered = track(api.prompt({ title: 'Назва', input: { initialValue: 'старт' } }))
    await flush()
    expect(api._state.inputValue.value).toBe('старт')

    api._state.inputValue.value = 'нова назва'
    api._accept()
    await flush()
    expect(entered.value).toBe('нова назва')

    const cancelled = track(api.prompt({ title: 'Назва', input: {} }))
    api._cancel()
    await flush()
    expect(cancelled.value).toBeNull()
  })

  it('обовʼязкове поле: порожнє значення не закриває діалог', async () => {
    const state = track(api.prompt({ title: 'Slug', input: { required: true } }))
    api._state.inputValue.value = '   '
    api._accept()
    await flush()

    expect(state.settled).toBe(false)
    expect(api._state.isOpen.value).toBe(true)
  })

  it('другий виклик поверх відкритого скасовує ПЕРШИЙ, а не себе', async () => {
    const first = track(api.confirm('Перший'))
    await flush()

    const second = track(api.confirm({ title: 'Другий', message: 'Другий' }))
    await flush()

    expect(first.value).toBe(false)
    expect(second.settled).toBe(false)
    expect(api._state.isOpen.value).toBe(true)
    expect(api._state.options.value.title).toBe('Другий')

    api._accept()
    await flush()
    expect(second.value).toBe(true)
  })

  it('витіснений prompt віддає null, а не false — його чекає string | null', async () => {
    const first = track(api.prompt({ title: 'Назва', input: {} }))
    await flush()

    track(api.confirm('Інше питання'))
    await flush()

    expect(first.value).toBeNull()
  })
})

describe('UiConfirmDialog — фокус на відкритті', () => {
  let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null

  afterEach(() => {
    mounted?.unmount()
    mounted = null
  })

  /** Монтує рендерер і відкриває діалог заданого виду. */
  async function openDialog(open: (api: Awaited<ReturnType<typeof loadConfirm>>) => void) {
    const api = await loadConfirm()
    const { default: UiConfirmDialog } = await import('~/components/ui/UiConfirmDialog.vue')
    mounted = await mountComponent(UiConfirmDialog)
    open(api)
    await nextTick()
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
    return api
  }

  it('звичайне підтвердження фокусує кнопку дії', async () => {
    await openDialog(api => void api.confirm({ message: 'Точно?', confirmText: 'Так' }))
    expect(document.activeElement?.textContent?.trim()).toBe('Так')
  })

  it('небезпечна дія фокусує «Скасувати» — Enter за інерцією нічого не видаляє', async () => {
    await openDialog(api => void api.confirm({ message: 'Видалити?', confirmText: 'Видалити', danger: true }))
    expect(document.activeElement?.textContent?.trim()).toBe('Скасувати')
  })

  it('prompt фокусує поле введення', async () => {
    await openDialog(api => void api.prompt({ title: 'Назва', input: { label: 'Назва' } }))
    expect(document.activeElement?.tagName).toBe('INPUT')
  })
})
