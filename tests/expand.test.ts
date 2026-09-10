import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'
import UiExpand from '~/components/ui/UiExpand.vue'
import { mountComponent } from './helpers/mountComponent'

describe('UiExpand', () => {
  it('keeps collapsed controls inert and preserves entered content through toggles', async () => {
    const updated = vi.fn()
    const mounted = await mountComponent(UiExpand, {
      title: 'Зауваження',
      'onUpdate:modelValue': updated,
    }, { default: () => h('input', { 'aria-label': 'Нотатка' }) })
    try {
      const trigger = mounted.host.querySelector('button')!
      const panel = mounted.host.querySelector<HTMLElement>('[role="region"]')!
      const input = mounted.host.querySelector('input')!
      expect(trigger.type).toBe('button')
      expect(trigger.getAttribute('aria-controls')).toBe(panel.id)
      expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id)
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(panel.hasAttribute('inert')).toBe(true)
      expect(panel.getAttribute('aria-hidden')).toBe('true')

      trigger.click()
      await nextTick()
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      expect(panel.hasAttribute('inert')).toBe(false)
      input.value = 'Залишити нотатку'
      trigger.click()
      await nextTick()
      trigger.click()
      await nextTick()
      expect(mounted.host.querySelector('input')).toBe(input)
      expect(input.value).toBe('Залишити нотатку')
      expect(updated.mock.calls).toEqual([[true], [false], [true]])
    } finally { mounted.unmount() }
  })

  it('lets a controlled parent accept or reject state changes', async () => {
    const updated = vi.fn()
    const mounted = await mountComponent(UiExpand, {
      title: 'Деталі', modelValue: false, defaultOpen: true, 'onUpdate:modelValue': updated,
    })
    try {
      const trigger = mounted.host.querySelector('button')!
      trigger.click()
      await nextTick()
      expect(updated).toHaveBeenCalledWith(true)
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      await mounted.update({ modelValue: true })
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      trigger.click()
      await nextTick()
      expect(updated).toHaveBeenLastCalledWith(false)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
    } finally { mounted.unmount() }
  })

  it('returns focus before an externally controlled panel closes', async () => {
    const mounted = await mountComponent(UiExpand, { title: 'Деталі', modelValue: true }, {
      default: () => h('a', { href: '#details' }, 'Детальніше'),
    })
    try {
      const link = mounted.host.querySelector('a')!
      link.focus()
      expect(document.activeElement).toBe(link)
      await mounted.update({ modelValue: false })
      expect(document.activeElement).toBe(mounted.host.querySelector('button'))
      expect(mounted.host.querySelector('[role="region"]')!.hasAttribute('inert')).toBe(true)
    } finally { mounted.unmount() }
  })

  it('supports default-open without resetting on rerenders and ignores disabled toggles', async () => {
    const updated = vi.fn()
    const mounted = await mountComponent(UiExpand, {
      title: 'Деталі', defaultOpen: true, disabled: true, 'onUpdate:modelValue': updated,
    })
    try {
      const trigger = mounted.host.querySelector('button')!
      trigger.click()
      await nextTick()
      expect(updated).not.toHaveBeenCalled()
      expect(trigger.disabled).toBe(true)
      await mounted.update({ disabled: false })
      trigger.click()
      await nextTick()
      await mounted.update({ title: 'Оновлені деталі' })
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
    } finally { mounted.unmount() }
  })

  it('renders unique linked IDs on the server and meaningful title/count slots', async () => {
    const html = await renderToString(createSSRApp({
      render: () => h('div', [
        h(UiExpand, { title: 'Зауваження' }, {
          title: () => h('strong', 'Перевірка'),
          trailing: () => h('span', '3'),
          default: () => 'Пояснення',
        }),
        h(UiExpand, { title: 'Деталі', defaultOpen: true }),
      ]),
    }))
    const document = new DOMParser().parseFromString(html, 'text/html')
    const buttons = [...document.querySelectorAll('button')]
    expect(buttons[0]!.textContent).toContain('Перевірка')
    expect(buttons[0]!.textContent).toContain('3')
    expect(new Set(buttons.map(button => button.id)).size).toBe(2)
    for (const button of buttons) {
      const panel = document.getElementById(button.getAttribute('aria-controls')!)!
      expect(panel.getAttribute('aria-labelledby')).toBe(button.id)
      expect(panel.hasAttribute('inert')).toBe(button.getAttribute('aria-expanded') === 'false')
    }
  })
})
