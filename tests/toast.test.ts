import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import UiToaster from '~/components/ui/UiToaster.vue'
import { useToast } from '~/composables/useToast'
import { mountComponent } from './helpers/mountComponent'

const toast = useToast()
let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null

async function mount() {
  mounted = await mountComponent(UiToaster)
  await nextTick()
}

function region() {
  return document.querySelector<HTMLElement>('[aria-label="Сповіщення"]')!
}
function card(id: number) {
  return document.querySelector<HTMLElement>(`[data-toast-id="${id}"] .ui-toast-card`)!
}
function clearButton() {
  return region().querySelector<HTMLButtonElement>('.ui-toaster-clear')
}
async function settle() {
  await nextTick()
  await nextTick()
  // Наступний браузерний event приходить окремим task. Vue відкидає
  // синтетичний bubbling у ту саму мілісекунду, коли встановив listener.
  if (vi.isFakeTimers()) vi.advanceTimersByTime(1)
  else await new Promise((resolve) => setTimeout(resolve, 1))
}

function pointer(target: EventTarget, type: string, options: PointerEventInit = {}) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      clientX: 100,
      clientY: 100,
      ...options,
    }),
  )
}

function touch(target: EventTarget, type: string, identifiers = [1]) {
  const event = new Event(type, { bubbles: true })
  Object.defineProperty(event, 'changedTouches', {
    value: identifiers.map((identifier) => ({ identifier })),
  })
  target.dispatchEvent(event)
}

afterEach(() => {
  mounted?.unmount()
  mounted = null
  toast.dismissAll()
  document.body.replaceChildren()
  vi.useRealTimers()
})

describe('useToast — очищення черги', () => {
  it('прибирає активні, призупинені та постійні повідомлення і всі таймери', () => {
    vi.useFakeTimers()
    toast.success('Активний')
    const paused = toast.error('На паузі')
    toast.pause(paused)
    const sticky = toast.info('Постійний', { duration: 0 })
    toast.dismissAll()
    expect(toast.toasts.value).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
    expect(() => toast.dismissAll()).not.toThrow()
    toast.resume(paused)
    const fresh = toast.info('Новий')
    expect(fresh).toBeGreaterThan(sticky)
    vi.advanceTimersByTime(2999)
    expect(toast.toasts.value.map((item) => item.id)).toEqual([fresh])
    vi.advanceTimersByTime(1)
    expect(toast.toasts.value).toEqual([])
  })
})

describe('UiToaster — список і доступність', () => {
  it('показує панель на переході 2→3, ховає на 3→2 та очищує всю чергу', async () => {
    await mount()
    toast.info('Один', { duration: 0 })
    toast.info('Два', { duration: 0 })
    await settle()
    expect(clearButton()).toBeNull()
    const third = toast.info('Три', { duration: 0 })
    await settle()
    expect(region().querySelector('.ui-toaster-count')?.textContent).toContain('3')
    expect(clearButton()?.textContent).toContain('Очистити всі')
    toast.dismiss(third)
    await settle()
    expect(clearButton()).toBeNull()
    toast.info('Чотири', { duration: 0 })
    await settle()
    clearButton()!.click()
    await settle()
    expect(toast.toasts.value).toHaveLength(0)
    expect(clearButton()).toBeNull()
  })

  it('зберігає порядок, live-ролі, назви кнопок та не перехоплює фокус', async () => {
    await mount()
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const info = toast.info('Перше', { title: 'Інформація', duration: 0 })
    const error = toast.error('Друге', { duration: 0 })
    await settle()
    expect(
      [...region().querySelectorAll('[data-toast-id]')].map((el) =>
        Number((el as HTMLElement).dataset.toastId),
      ),
    ).toEqual([info, error])
    // Картка — не live-регіон: регіон, вставлений разом із текстом,
    // оголошується ненадійно. Текст іде в постійні регіони контейнера.
    expect(card(info).hasAttribute('aria-live')).toBe(false)
    expect(card(error).hasAttribute('aria-live')).toBe(false)
    expect(region().querySelector('[aria-live="polite"]')?.textContent).toContain('Інформація. Перше')
    expect(region().querySelector('[aria-live="assertive"]')?.textContent).toContain('Друге')
    expect(region().hasAttribute('data-overlay-ignore')).toBe(true)
    expect(card(info).querySelector('button')?.getAttribute('aria-label')).toBe(
      'Закрити сповіщення',
    )
    expect(document.activeElement).toBe(trigger)
    card(info).querySelector('button')!.focus()
    card(info).querySelector('button')!.click()
    await settle()
    expect(document.activeElement).toBe(card(error).querySelector('button'))
    card(error).querySelector('button')!.click()
    await settle()
    expect(document.activeElement).toBe(trigger)
  })

  it('після закриття з клавіатури переносить фокус на сусіднє повідомлення', async () => {
    await mount()
    const first = toast.info('Перше', { duration: 0 })
    const middle = toast.info('Друге', { duration: 0 })
    const last = toast.info('Третє', { duration: 0 })
    await settle()
    card(middle).querySelector('button')!.focus()
    card(middle).querySelector('button')!.click()
    await settle()
    expect(document.activeElement).toBe(card(last).querySelector('button'))
    card(last).querySelector('button')!.click()
    await settle()
    expect(document.activeElement).toBe(card(first).querySelector('button'))
  })

  it('дія викликає callback один раз, не починає свайп та не закриває тост', async () => {
    await mount()
    const onClick = vi.fn()
    const id = toast.info('Дія', { duration: 0, actions: [{ label: 'Виконати', onClick }] })
    await settle()
    const button = card(id).querySelector('.ui-toast-action') as HTMLButtonElement
    pointer(button, 'pointerdown')
    pointer(window, 'pointermove', { clientX: 200 })
    pointer(window, 'pointerup', { clientX: 200 })
    button.click()
    await settle()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(toast.toasts.value.map((item) => item.id)).toEqual([id])
  })

  it('прокручує лише якщо користувач був біля кінця списку', async () => {
    await mount()
    toast.info('Перший', { duration: 0 })
    await settle()
    const list = region().querySelector('.ui-toaster-viewport') as HTMLElement
    Object.defineProperties(list, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } })
    list.scrollTop = 120
    toast.info('Другий', { duration: 0 })
    await settle()
    expect(list.scrollTop).toBe(120)
    list.scrollTop = 780
    toast.info('Третій', { duration: 0 })
    await settle()
    expect(list.scrollTop).toBe(1000)
  })
})

describe('UiToaster — смужки прокрутки під час анімації', () => {
  const viewport = () => region().querySelector<HTMLElement>('.ui-toaster-viewport')!
  const locked = () => viewport().hasAttribute('data-animating')

  it('вимикає вертикальну прокрутку на вході й виході, поки стос вміщається', async () => {
    await mount()
    const id = toast.info('Привіт', { duration: 0 })
    await nextTick()
    // Вхід зсуває картку за межі списку; без блокування це смужка прокрутки.
    expect(locked()).toBe(true)
    await vi.waitFor(() => expect(locked()).toBe(false))

    toast.dismiss(id)
    await nextTick()
    expect(locked()).toBe(true)
    await vi.waitFor(() => expect(document.querySelector('[data-toast-id]')).toBeNull())
    expect(locked()).toBe(false)
  })

  it('знімає блокування, коли тост закрито посеред входу', async () => {
    await mount()
    const id = toast.info('Швидко', { duration: 0 })
    await nextTick()
    toast.dismiss(id)
    await settle()
    await vi.waitFor(() => expect(document.querySelector('[data-toast-id]')).toBeNull())
    expect(locked()).toBe(false)
  })

  it('не чіпає прокрутку, якщо стос і так довший за видиму область', async () => {
    await mount()
    toast.info('Перший', { duration: 0 })
    await settle()
    await vi.waitFor(() => expect(locked()).toBe(false))
    // Справжнє переповнення: смужка потрібна й під час анімації, інакше блимала б.
    Object.defineProperty(viewport(), 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(viewport().firstElementChild!, 'offsetHeight', { value: 400, configurable: true })
    toast.info('Другий', { duration: 0 })
    await settle()
    expect(locked()).toBe(false)
  })
})

describe('UiToaster — свайпи', () => {
  it.each([-48, 48])('закриває лише вибрану картку при зсуві %i px', async (dx) => {
    await mount()
    const id = toast.info('Змахнути', { duration: 0 })
    const other = toast.info('Залишити', { duration: 0 })
    await settle()
    const target = card(id)
    pointer(target, 'pointerdown')
    pointer(window, 'pointermove', { clientX: 100 + dx })
    await settle()
    expect(target.style.getPropertyValue('--toast-drag-x')).toBe(`${dx}px`)
    pointer(window, 'pointerup', { clientX: 100 + dx })
    await settle()
    expect(toast.toasts.value.map((item) => item.id)).toEqual([other])
  })

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])(
    'повертає картку після %s без закриття',
    async (end) => {
      await mount()
      const id = toast.info('Залишити', { duration: 0 })
      await settle()
      const target = card(id)
      const dx = end === 'pointerup' ? 47 : 90
      pointer(target, 'pointerdown')
      pointer(window, 'pointermove', { clientX: 100 + dx })
      await settle()
      pointer(end === 'lostpointercapture' ? target : window, end, { clientX: 100 + dx })
      await settle()
      expect(toast.toasts.value.map((item) => item.id)).toEqual([id])
      expect(target.style.getPropertyValue('--toast-drag-x')).toBe('')
      expect(target.classList.contains('is-dragging')).toBe(false)
    },
  )

  it('не перетворює вертикальний скрол на свайп навіть після зміни напрямку', async () => {
    await mount()
    const id = toast.info('Скрол', { duration: 0 })
    await settle()
    pointer(card(id), 'pointerdown')
    pointer(window, 'pointermove', { clientX: 103, clientY: 107 })
    await settle()
    expect(card(id).classList.contains('is-dragging')).toBe(false)
    pointer(window, 'pointermove', { clientX: 103, clientY: 120 })
    pointer(window, 'pointermove', { clientX: 200, clientY: 125 })
    pointer(window, 'pointerup', { clientX: 200, clientY: 125 })
    await settle()
    expect(toast.toasts.value.map((item) => item.id)).toEqual([id])
  })

  it('ігнорує другий вказівник і праву кнопку миші', async () => {
    await mount()
    const id = toast.info('Перший', { duration: 0 })
    const other = toast.info('Другий', { duration: 0 })
    await settle()
    pointer(card(id), 'pointerdown', { button: 2, pointerType: 'mouse' })
    pointer(window, 'pointermove', { clientX: 200 })
    pointer(window, 'pointerup', { clientX: 200 })
    expect(toast.toasts.value).toHaveLength(2)
    pointer(card(id), 'pointerdown')
    pointer(card(other), 'pointerdown', { pointerId: 2, isPrimary: false })
    pointer(window, 'pointermove', { pointerId: 2, clientX: 250 })
    pointer(window, 'pointerup', { pointerId: 2, clientX: 250 })
    expect(toast.toasts.value).toHaveLength(2)
    pointer(window, 'pointermove', { clientX: 160 })
    pointer(window, 'pointerup', { clientX: 160 })
    await settle()
    expect(toast.toasts.value.map((item) => item.id)).toEqual([other])
  })
})

describe('UiToaster — пауза всієї черги', () => {
  it('чекає завершення hover, focus і дотику; нові тости теж на паузі', async () => {
    vi.useFakeTimers()
    await mount()
    const id = toast.info('Перший', { duration: 3000 })
    await settle()
    vi.advanceTimersByTime(2950)
    pointer(region(), 'pointerenter', { pointerType: 'mouse' })
    card(id).querySelector('button')!.focus()
    pointer(card(id), 'pointerdown')
    const fresh = toast.info('Новий', { duration: 2000 })
    await settle()
    pointer(region(), 'pointerleave', { pointerType: 'mouse' })
    vi.advanceTimersByTime(5000)
    expect(toast.toasts.value).toHaveLength(2)
    ;(document.activeElement as HTMLElement).blur()
    vi.advanceTimersByTime(5000)
    expect(toast.toasts.value).toHaveLength(2)
    pointer(window, 'pointercancel')
    vi.advanceTimersByTime(999)
    expect(toast.toasts.value).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(toast.toasts.value.map((item) => item.id)).toEqual([fresh])
    vi.advanceTimersByTime(1000)
    expect(toast.toasts.value).toHaveLength(0)
  })

  it('тримає паузу під час нативного скролу до touchend після pointercancel', async () => {
    vi.useFakeTimers()
    await mount()
    const id = toast.info('Скрол', { duration: 1000 })
    await settle()
    pointer(card(id), 'pointerdown')
    touch(card(id), 'touchstart')
    pointer(window, 'pointermove', { clientY: 200 })
    pointer(window, 'pointercancel')
    vi.advanceTimersByTime(5000)
    expect(toast.toasts.value).toHaveLength(1)
    touch(window, 'touchend')
    vi.advanceTimersByTime(1000)
    expect(toast.toasts.value).toHaveLength(0)
  })

  it('демонтаж прибирає обробники й відновлює призупинену чергу', async () => {
    vi.useFakeTimers()
    await mount()
    const id = toast.info('Пауза', { duration: 1000 })
    await settle()
    pointer(region(), 'pointerenter', { pointerType: 'mouse' })
    pointer(card(id), 'pointerdown')
    mounted!.unmount()
    mounted = null
    pointer(window, 'pointermove', { clientX: 200 })
    pointer(window, 'pointerup', { clientX: 200 })
    expect(toast.toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(toast.toasts.value).toHaveLength(0)
  })
})
