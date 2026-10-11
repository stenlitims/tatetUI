import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBackGuard, isGuardState, type BackGuard } from '~/utils/backGuard'

/** Історія як у браузері: записи, курсор і асинхронний popstate після go(). */
function fakeHistory() {
  const target = new EventTarget()
  const entries: unknown[] = [{ position: 0, current: '/c/1' }]
  let index = 0
  const routerPops: unknown[] = []
  // Як lib/popstateFirst: обробники охоронця — раніше за «роутер».
  const first = new Set<(e: Event) => void>()
  target.addEventListener('popstate', (e) => {
    for (const h of [...first]) h(e)
  })
  const listen = (h: (e: Event) => void) => {
    first.add(h)
    return () => first.delete(h)
  }
  // «vue-router»: зареєстрований пізніше, бачить лише те, що охоронець пропустив.
  target.addEventListener('popstate', (e) => routerPops.push((e as PopStateEvent).state))
  const history = {
    get state() {
      return entries[index]
    },
    pushState(data: unknown) {
      entries.splice(index + 1)
      entries.push(data)
      index += 1
    },
    go(delta: number) {
      setTimeout(() => {
        index = Math.max(0, Math.min(entries.length - 1, index + delta))
        target.dispatchEvent(new PopStateEvent('popstate', { state: entries[index] }))
      }, 0)
    },
  }
  /** Системне «назад» користувача. */
  const userBack = () => history.go(-1)
  return { listen, history, entries, routerPops, userBack, index: () => index }
}

const tick = () => new Promise((r) => setTimeout(r, 5))

describe('createBackGuard', () => {
  let guard: BackGuard | undefined
  afterEach(() => guard?.stop())

  function setup() {
    const h = fakeHistory()
    let layers = 0
    const dismiss = vi.fn(() => {
      layers = Math.max(0, layers - 1)
    })
    guard = createBackGuard({ history: h.history, listen: h.listen, depth: () => layers, dismiss })
    const open = (n = 1) => {
      layers += n
      guard!.schedule()
    }
    const closeByUi = () => {
      layers = Math.max(0, layers - 1)
      guard!.schedule()
    }
    return { h, dismiss, open, closeByUi, layers: () => layers, setLayers: (n: number) => (layers = n) }
  }

  it('відкритий шар ставить охоронця з тією самою адресою', async () => {
    const { h, open } = setup()
    open()
    await tick()
    expect(h.entries).toHaveLength(2)
    expect(isGuardState(h.history.state)).toBe(true)
    expect((h.history.state as { current: string }).current).toBe('/c/1')
  })

  it('«назад» над шаром закриває шар, а не екран — роутер нічого не бачить', async () => {
    const { h, open, dismiss, layers } = setup()
    open()
    await tick()
    h.userBack()
    await tick()
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(layers()).toBe(0)
    expect(h.routerPops).toHaveLength(0)
    expect(h.index()).toBe(0)
  })

  it('шар закрили хрестиком — охоронця знято, роутер не бачить кроку', async () => {
    const { h, open, closeByUi } = setup()
    open()
    await tick()
    closeByUi()
    await tick()
    await tick()
    expect(h.index()).toBe(0)
    expect(h.routerPops).toHaveLength(0)
    // Наступне «назад» — уже звичайна навігація.
    h.userBack()
    await tick()
    expect(h.routerPops).toHaveLength(1)
  })

  it('вкладені шари: кожне «назад» закриває один', async () => {
    const { h, open, dismiss, layers } = setup()
    open(2)
    await tick()
    expect(h.entries).toHaveLength(3)
    h.userBack()
    await tick()
    expect(layers()).toBe(1)
    h.userBack()
    await tick()
    expect(layers()).toBe(0)
    expect(dismiss).toHaveBeenCalledTimes(2)
    expect(h.routerPops).toHaveLength(0)
  })

  it('шар відмовився закритися (зайнятий) — охоронець повертається', async () => {
    const { h, open, dismiss, setLayers } = setup()
    open()
    await tick()
    dismiss.mockImplementation(() => setLayers(1))
    h.userBack()
    await tick()
    await tick()
    expect(isGuardState(h.history.state)).toBe(true)
    expect(h.routerPops).toHaveLength(0)
  })

  it('перехід над відкритим шаром спершу знімає охоронців (release)', async () => {
    const { h, open } = setup()
    open()
    await tick()
    await guard!.release()
    expect(h.index()).toBe(0)
    expect(isGuardState(h.history.state)).toBe(false)
    // Поки триває перехід, нових охоронців не ставимо, навіть якщо шар ще відкритий.
    guard!.schedule()
    await tick()
    expect(h.index()).toBe(0)
    guard!.resume()
    await tick()
    expect(isGuardState(h.history.state)).toBe(true)
  })

  it('без шарів не втручається в історію', async () => {
    const { h } = setup()
    guard!.schedule()
    await tick()
    h.userBack()
    await tick()
    expect(h.entries).toHaveLength(1)
    expect(h.routerPops).toHaveLength(1)
  })
})
