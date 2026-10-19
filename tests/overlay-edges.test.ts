import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import UiDrawer from '~/components/ui/UiDrawer.vue'
import UiModal from '~/components/ui/UiModal.vue'
import { mountComponent } from './helpers/mountComponent'

/*
 * Шапка й футер UiModal і UiDrawer пласкі: лінія під шапкою — лише коли
 * вміст прокручено під неї, над футером — лише поки нижче є непрокручений
 * вміст. Верстки в happy-dom немає, тож розміри області прокрутки задано
 * на самому елементі.
 */

type Mounted = Awaited<ReturnType<typeof mountComponent>>
let mounted: Mounted | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.body.replaceChildren()
  document.body.removeAttribute('style')
})

async function flush() {
  for (let index = 0; index < 6; index += 1) {
    await nextTick()
    await Promise.resolve()
  }
}

/** Область прокрутки з `scrollHeight` вмісту й видимою висотою `clientHeight`. */
function sizeBody(body: HTMLElement, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(body, 'scrollHeight', { configurable: true, get: () => scrollHeight })
  Object.defineProperty(body, 'clientHeight', { configurable: true, get: () => clientHeight })
}

async function scrollBody(body: HTMLElement, top: number) {
  body.scrollTop = top
  body.dispatchEvent(new Event('scroll'))
  await flush()
}

async function open(component: typeof UiModal | typeof UiDrawer) {
  mounted = await mountComponent(
    component,
    { modelValue: true, title: 'Форма' },
    { default: () => h('p', 'Вміст'), footer: () => h('button', { type: 'button' }, 'Зберегти') },
  )
  await flush()
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
  const header = dialog.querySelector('h3')!.closest<HTMLElement>('.border-b')!
  const body = dialog.querySelector<HTMLElement>('.overflow-y-auto')!
  const footer = dialog.querySelector<HTMLElement>('.border-t')!
  return { header, body, footer }
}

const lineOf = (el: HTMLElement) =>
  el.classList.contains('border-line') ? 'line' : el.classList.contains('border-transparent') ? 'none' : 'both?'

describe.each([
  ['UiModal', UiModal],
  ['UiDrawer', UiDrawer],
] as const)('%s: пласка шапка й футер', (_name, component) => {
  it('короткий вміст — жодної лінії', async () => {
    const { header, footer } = await open(component)
    expect(lineOf(header)).toBe('none')
    expect(lineOf(footer)).toBe('none')
  })

  it('лінії йдуть за прокруткою: під шапкою — вміст згори, над футером — знизу', async () => {
    const { header, body, footer } = await open(component)
    sizeBody(body, 1000, 400)

    await scrollBody(body, 0)
    expect([lineOf(header), lineOf(footer)]).toEqual(['none', 'line'])

    await scrollBody(body, 300)
    expect([lineOf(header), lineOf(footer)]).toEqual(['line', 'line'])

    // Дробовий масштаб: до кінця бракує пів пікселя — це вже низ.
    await scrollBody(body, 599.5)
    expect([lineOf(header), lineOf(footer)]).toEqual(['line', 'none'])
  })

  it('вміст, що виріс без прокрутки, теж вмикає лінію над футером', async () => {
    const { body, footer } = await open(component)
    expect(lineOf(footer)).toBe('none')
    // Під полем з'явилась помилка: прокрутки не було, змінився лише вміст.
    sizeBody(body, 900, 400)
    body.append(document.createElement('p'))
    await flush()
    expect(lineOf(footer)).toBe('line')
  })
})
