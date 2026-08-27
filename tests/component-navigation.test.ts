import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import UiCommandPalette from '~/components/ui/UiCommandPalette.vue'
import UiStepper from '~/components/ui/UiStepper.vue'
import UiTable from '~/components/ui/UiTable.vue'
import UiTabs from '~/components/ui/UiTabs.vue'
import UiToggleGroup from '~/components/ui/UiToggleGroup.vue'
import UiTree from '~/components/ui/UiTree.vue'
import { mountComponent } from './helpers/mountComponent'

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.style.overflow = ''
})

describe('keyboard navigation', () => {
  it('ToggleGroup має roving tabindex і пропускає disabled radio', async () => {
    const selected: unknown[] = []
    const mounted = await mountComponent(UiToggleGroup, {
      modelValue: 'a',
      ariaLabel: 'Режим',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true },
        { value: 'c', label: 'C' },
      ],
      'onUpdate:modelValue': (value: unknown) => selected.push(value),
    })
    const radios = [...mounted.host.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1])
    radios[0]!.focus()
    radios[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await nextTick()
    expect(document.activeElement).toBe(radios[2])
    expect(selected).toEqual(['c'])
    mounted.unmount()
  })

  it('Tree тримає один treeitem і повертає active row до parent після collapse', async () => {
    const mounted = await mountComponent(UiTree, {
      expanded: ['root'],
      items: [
        {
          id: 'root',
          label: 'Root',
          children: [{ id: 'child', label: 'Child' }],
        },
      ],
    })
    let rows = [...mounted.host.querySelectorAll<HTMLElement>('[role="treeitem"]')]
    expect(rows).toHaveLength(2)
    expect(rows[0]!.querySelector('[role="button"]')).toBeNull()
    rows[1]!.focus()
    rows[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await nextTick()
    expect(document.activeElement).toBe(rows[0])

    rows[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await nextTick()
    rows = [...mounted.host.querySelectorAll<HTMLElement>('[role="treeitem"]')]
    expect(rows).toHaveLength(1)
    expect(rows[0]!.tabIndex).toBe(0)
    mounted.unmount()
  })

  it('Tabs нормалізує query/disabled вкладки та лишає slot усередині button', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    await router.push('/?tab=c')
    await router.isReady()
    const changed: unknown[] = []
    const mounted = await mountComponent(
      UiTabs,
      {
        modelValue: 'missing',
        queryParam: 'tab',
        tabs: [
          { id: 'a', label: 'A', disabled: true },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ],
        'onUpdate:modelValue': (value: unknown) => changed.push(value),
      },
      { 'tab-c': () => 'Custom C', 'panel-c': () => 'Panel C' },
      { plugins: [router] },
    )
    let tabs = [...mounted.host.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    expect(tabs[2]!.getAttribute('aria-selected')).toBe('true')
    expect(tabs[2]!.textContent).toContain('Custom C')

    await router.push('/?tab=b')
    await nextTick()
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')

    await mounted.update({ tabs: [{ id: 'd', label: 'D' }] })
    tabs = [...mounted.host.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    expect(tabs).toHaveLength(1)
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    expect(changed).toContain('d')
    mounted.unmount()
  })
})

describe('selection and data edge cases', () => {
  it('Stepper реально disables недоступні майбутні кроки', async () => {
    const selected: unknown[] = []
    const mounted = await mountComponent(UiStepper, {
      modelValue: 0,
      clickMode: 'visited',
      steps: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      'onUpdate:modelValue': (value: unknown) => selected.push(value),
    })
    const steps = [...mounted.host.querySelectorAll<HTMLButtonElement>('button')]
    expect(steps.map((step) => step.disabled)).toEqual([false, false, true])
    steps[2]!.click()
    expect(selected).toEqual([])
    steps[1]!.click()
    expect(selected).toEqual([1])
    mounted.unmount()
  })

  it('CommandPalette вибирає саме клікнутий рядок та звʼязує active option', async () => {
    const selected: unknown[] = []
    const mounted = await mountComponent(UiCommandPalette, {
      modelValue: true,
      hotkey: false,
      groups: [
        {
          id: 'actions',
          label: 'Дії',
          items: [
            { id: 'first', label: 'Перша' },
            { id: 'second', label: 'Друга' },
          ],
        },
      ],
      onSelect: (value: unknown) => selected.push(value),
    })
    await nextTick()
    await nextTick()
    const input = document.body.querySelector<HTMLInputElement>('[role="combobox"]')!
    const options = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
    expect(options).toHaveLength(2)
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]!.id)
    options[1]!.click()
    expect(selected).toEqual([{ groupId: 'actions', item: 'second' }])
    mounted.unmount()
  })

  it('Table завжди лишає порожні значення в кінці при desc sorting', async () => {
    const mounted = await mountComponent(UiTable, {
      headers: [{ value: 'name', text: 'Назва', sortable: true }],
      items: [
        { id: 1, name: null },
        { id: 2, name: 'Alpha' },
        { id: 3, name: 'Zulu' },
        { id: 4, name: '' },
      ],
      sort: { by: 'name', dir: 'desc' },
    })
    await nextTick()
    const values = [...mounted.host.querySelectorAll<HTMLTableRowElement>('tbody tr')]
      .map((row) => row.textContent?.trim())
    expect(values).toEqual(['Zulu', 'Alpha', '—', ''])
    mounted.unmount()
  })
})
