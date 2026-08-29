import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import UiInlineEdit from '~/components/ui/UiInlineEdit.vue'
import UiTextarea from '~/components/ui/UiTextarea.vue'
import { mountComponent } from './helpers/mountComponent'

let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('UiInlineEdit', () => {
  it('блокує invalid commit і повʼязує помилку з полем', async () => {
    const saved: unknown[] = []
    mounted = await mountComponent(UiInlineEdit, {
      modelValue: 'Старе значення',
      error: 'Значення вже існує',
      onSave: (value: unknown) => saved.push(value),
    })
    mounted.host.querySelector<HTMLButtonElement>('button')!.click()
    await nextTick()
    const input = mounted.host.querySelector<HTMLInputElement>('input')!
    const described = input.getAttribute('aria-describedby')!
    expect(mounted.host.querySelector(`#${described}`)?.getAttribute('role')).toBe('alert')

    input.value = 'Нове значення'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    expect(saved).toHaveLength(0)
    expect(mounted.host.querySelector('input')).toBe(input)
  })

  it('після Enter та Escape повертає фокус на кнопку', async () => {
    mounted = await mountComponent(UiInlineEdit, { modelValue: 'Значення' })
    mounted.host.querySelector<HTMLButtonElement>('button')!.click()
    await nextTick()
    const input = mounted.host.querySelector<HTMLInputElement>('input')!
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    expect(document.activeElement).toBe(mounted.host.querySelector('button'))

    mounted.host.querySelector<HTMLButtonElement>('button')!.click()
    await nextTick()
    mounted.host.querySelector<HTMLInputElement>('input')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(document.activeElement).toBe(mounted.host.querySelector('button'))
  })

  it('blur не перехоплює фокус', async () => {
    const outside = document.createElement('button')
    document.body.append(outside)
    mounted = await mountComponent(UiInlineEdit, { modelValue: 'Значення' })
    mounted.host.querySelector<HTMLButtonElement>('button')!.click()
    await nextTick()
    const input = mounted.host.querySelector<HTMLInputElement>('input')!
    outside.focus()
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true, relatedTarget: outside }))
    await nextTick()
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })
})

describe('UiTextarea', () => {
  it('передає maxlength і показує лічильник', async () => {
    mounted = await mountComponent(UiTextarea, { modelValue: 'Привіт', maxLength: 20, showCount: true })
    const textarea = mounted.host.querySelector<HTMLTextAreaElement>('textarea')!
    expect(textarea.maxLength).toBe(20)
    expect(mounted.host.textContent).toContain('6 / 20')
    const described = textarea.getAttribute('aria-describedby')!
    expect(mounted.host.querySelector(`#${described}`)?.textContent).toContain('6 / 20')
  })

  it('тримає пріоритет error → hint → counter', async () => {
    mounted = await mountComponent(UiTextarea, {
      modelValue: 'Текст', maxLength: 20, showCount: true, hint: 'Підказка', error: 'Помилка',
    })
    const textarea = mounted.host.querySelector<HTMLTextAreaElement>('textarea')!
    let described = textarea.getAttribute('aria-describedby')!
    expect(mounted.host.querySelector(`#${described}`)?.textContent).toBe('Помилка')
    expect(mounted.host.querySelector(`#${described}`)?.getAttribute('role')).toBe('alert')

    await mounted.update({ error: undefined })
    described = textarea.getAttribute('aria-describedby')!
    expect(mounted.host.querySelector(`#${described}`)?.textContent).toBe('Підказка')

    await mounted.update({ hint: undefined })
    described = textarea.getAttribute('aria-describedby')!
    expect(mounted.host.querySelector(`#${described}`)?.textContent).toContain('5 / 20')
  })
})
