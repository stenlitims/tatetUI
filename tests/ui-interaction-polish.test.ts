import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiInputOtp from '~/components/ui/UiInputOtp.vue'
import UiTabs from '~/components/ui/UiTabs.vue'
import { useToast } from '~/composables/useToast'
import { mountComponent } from './helpers/mountComponent'

let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
  const toast = useToast()
  for (const item of [...toast.toasts.value]) toast.dismiss(item.id)
  vi.useRealTimers()
})

describe('useToast — пауза автозакриття', () => {
  it('pause зупиняє відлік, resume продовжує з того ж місця', () => {
    vi.useFakeTimers()
    const toast = useToast()
    const id = toast.show({ message: 'Збережено', duration: 3000 })

    vi.advanceTimersByTime(2000)
    toast.pause(id)
    // На паузі час не йде: через будь-який інтервал тост на місці.
    vi.advanceTimersByTime(10_000)
    expect(toast.toasts.value.map((item) => item.id)).toContain(id)

    toast.resume(id)
    // Лишалась 1 с — рівно стільки й чекаємо після resume.
    vi.advanceTimersByTime(999)
    expect(toast.toasts.value.map((item) => item.id)).toContain(id)
    vi.advanceTimersByTime(1)
    expect(toast.toasts.value.map((item) => item.id)).not.toContain(id)
  })

  it('resume дає щонайменше секунду, якщо лишалося менше', () => {
    vi.useFakeTimers()
    const toast = useToast()
    const id = toast.show({ message: 'Майже зник', duration: 3000 })

    vi.advanceTimersByTime(2950)
    toast.pause(id)
    toast.resume(id)
    vi.advanceTimersByTime(900)
    expect(toast.toasts.value.map((item) => item.id)).toContain(id)
    vi.advanceTimersByTime(100)
    expect(toast.toasts.value.map((item) => item.id)).not.toContain(id)
  })

  it('pause на тості без автозакриття і на невідомому id — без помилок', () => {
    vi.useFakeTimers()
    const toast = useToast()
    const sticky = toast.show({ message: 'Без таймера', duration: 0 })
    expect(() => toast.pause(sticky)).not.toThrow()
    expect(() => toast.resume(sticky)).not.toThrow()
    expect(() => toast.pause(999_999)).not.toThrow()
    vi.advanceTimersByTime(60_000)
    expect(toast.toasts.value.map((item) => item.id)).toContain(sticky)
  })
})

describe('UiInput — очищення й показ пароля', () => {
  it('кнопка очищення з’являється лише з непорожнім значенням і скидає його', async () => {
    const updates: unknown[] = []
    let cleared = 0
    mounted = await mountComponent(UiInput, {
      modelValue: '',
      clearable: true,
      'onUpdate:modelValue': (value: unknown) => updates.push(value),
      onClear: () => (cleared += 1),
    })
    expect(mounted.host.querySelector('[aria-label="Очистити поле"]')).toBeNull()

    await mounted.update({ modelValue: 'tatet' })
    const clear = mounted.host.querySelector<HTMLButtonElement>('[aria-label="Очистити поле"]')!
    expect(clear).not.toBeNull()
    // Не в Tab-обході: з клавіатури поле чистять Ctrl+A і Backspace.
    expect(clear.tabIndex).toBe(-1)

    clear.click()
    await nextTick()
    expect(updates).toEqual([''])
    expect(cleared).toBe(1)
    expect(document.activeElement).toBe(mounted.host.querySelector('input'))
  })

  it('для числового поля очищення віддає null, а не порожній рядок', async () => {
    const updates: unknown[] = []
    mounted = await mountComponent(UiInput, {
      modelValue: 42,
      type: 'number',
      clearable: true,
      'onUpdate:modelValue': (value: unknown) => updates.push(value),
    })
    mounted.host.querySelector<HTMLButtonElement>('[aria-label="Очистити поле"]')!.click()
    expect(updates).toEqual([null])
  })

  it('очищення недоступне для disabled і readonly', async () => {
    mounted = await mountComponent(UiInput, { modelValue: 'x', clearable: true, disabled: true })
    expect(mounted.host.querySelector('[aria-label="Очистити поле"]')).toBeNull()
    await mounted.update({ disabled: false, readonly: true })
    expect(mounted.host.querySelector('[aria-label="Очистити поле"]')).toBeNull()
  })

  it('перемикач пароля міняє type і лишається доступним з клавіатури', async () => {
    mounted = await mountComponent(UiInput, {
      modelValue: 'secret',
      type: 'password',
      passwordToggle: true,
    })
    const input = mounted.host.querySelector<HTMLInputElement>('input')!
    const toggle = mounted.host.querySelector<HTMLButtonElement>('[aria-pressed]')!
    expect(input.type).toBe('password')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(toggle.tabIndex).toBe(0)

    toggle.click()
    await nextTick()
    expect(input.type).toBe('text')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(toggle.getAttribute('aria-label')).toBe('Сховати пароль')
  })

  it('перемикач пароля не рендериться для інших типів', async () => {
    mounted = await mountComponent(UiInput, { modelValue: '', type: 'email', passwordToggle: true })
    expect(mounted.host.querySelector('[aria-pressed]')).toBeNull()
  })
})

describe('UiInputOtp — активна комірка', () => {
  it('підсвічує комірку, куди піде наступний символ, лише у фокусі', async () => {
    mounted = await mountComponent(UiInputOtp, { modelValue: '12', length: 4 })
    const input = mounted.host.querySelector<HTMLInputElement>('input')!
    const cells = () => [...mounted!.host.querySelectorAll<HTMLElement>('span[aria-hidden="true"]')]
    expect(cells().some((cell) => cell.className.includes('border-accent-solid'))).toBe(false)

    input.dispatchEvent(new FocusEvent('focus'))
    await nextTick()
    const active = cells().findIndex((cell) => cell.className.includes('border-accent-solid'))
    expect(active).toBe(2)

    await mounted.update({ modelValue: '1234' })
    // Код повний — підсвічена остання, а не неіснуюча п'ята.
    expect(cells().findIndex((cell) => cell.className.includes('border-accent-solid'))).toBe(3)

    input.dispatchEvent(new FocusEvent('blur'))
    await nextTick()
    expect(cells().some((cell) => cell.className.includes('border-accent-solid'))).toBe(false)
  })
})

describe('UiTabs — індикатор', () => {
  it('після монтування кнопка віддає межу індикатору, aria не змінюється', async () => {
    mounted = await mountComponent(UiTabs, {
      tabs: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    })
    const tabs = [...mounted.host.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    // Індикатор є, рівно один, і він прихований від допоміжних технологій.
    const indicators = mounted.host.querySelectorAll('[role="tablist"] > span[aria-hidden="true"]')
    expect(indicators).toHaveLength(1)
    expect(tabs[0]!.className).not.toContain('border-accent-solid')

    tabs[1]!.click()
    await nextTick()
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
    expect(mounted.host.querySelectorAll('[role="tablist"] > span[aria-hidden="true"]')).toHaveLength(1)
  })
})
