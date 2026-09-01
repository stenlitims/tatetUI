import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import UiAvatarGroup from '~/components/ui/UiAvatarGroup.vue'
import UiDescriptionList from '~/components/ui/UiDescriptionList.vue'
import UiSeparator from '~/components/ui/UiSeparator.vue'
import UiStatCard from '~/components/ui/UiStatCard.vue'
import { mountComponent } from './helpers/mountComponent'

let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('UiSeparator', () => {
  it('декоративний прихований від скрінрідера, смисловий — ні', async () => {
    mounted = await mountComponent(UiSeparator)
    let line = mounted.host.querySelector('div')!
    expect(line.getAttribute('aria-hidden')).toBe('true')
    expect(line.getAttribute('role')).toBeNull()

    await mounted.update({ decorative: false })
    line = mounted.host.querySelector('div')!
    expect(line.getAttribute('role')).toBe('separator')
    expect(line.getAttribute('aria-orientation')).toBe('horizontal')
    expect(line.getAttribute('aria-hidden')).toBeNull()
  })

  it('підпис сам робить роздільник смисловим і не звучить двічі', async () => {
    // decorative лишається true — підпис має перебити його.
    mounted = await mountComponent(UiSeparator, { label: 'Архів', decorative: true })
    const root = mounted.host.querySelector('div')!
    expect(root.getAttribute('role')).toBe('separator')
    expect(root.getAttribute('aria-label')).toBe('Архів')
    // Видимий текст прихований: ім'я вже прийшло з aria-label.
    const text = [...root.querySelectorAll('span')].find((el) => el.textContent?.includes('Архів'))!
    expect(text.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('UiStatCard', () => {
  it('розводить знак зміни і те, що вважати добрим', async () => {
    // Зростання при deltaGood="up" — успіх.
    mounted = await mountComponent(UiStatCard, { label: 'Виторг', value: '100', delta: 12, deltaGood: 'up' })
    expect(mounted.host.querySelector('.text-success')).not.toBeNull()
    expect(mounted.host.querySelector('.text-danger')).toBeNull()

    // Те саме зростання при deltaGood="down" — проблема.
    await mounted.update({ deltaGood: 'down' })
    expect(mounted.host.querySelector('.text-danger')).not.toBeNull()
    expect(mounted.host.querySelector('.text-success')).toBeNull()

    // Напрям не визначено — стрілка є, кольору немає.
    await mounted.update({ deltaGood: 'none' })
    expect(mounted.host.querySelector('.text-success')).toBeNull()
    expect(mounted.host.querySelector('.text-danger')).toBeNull()
    // Стрілка — SVG, а не текстовий гліф: лишається на місці і в нейтральному тоні.
    expect(mounted.host.querySelector('svg path')?.getAttribute('d')).toContain('M7 17')
  })

  it('стрілка прихована, а зміна має словесний еквівалент', async () => {
    mounted = await mountComponent(UiStatCard, { label: 'Виторг', value: '100', delta: -8 })
    const arrow = mounted.host.querySelector('svg')!
    expect(arrow.getAttribute('aria-hidden')).toBe('true')
    expect(arrow.querySelector('path')?.getAttribute('d')).toContain('M7 7l10 10')
    const spoken = [...mounted.host.querySelectorAll('.sr-only')].map((el) => el.textContent)
    expect(spoken.some((text) => text?.includes('падіння на 8'))).toBe(true)
  })

  it('valueLabel зачитується замість скороченого значення', async () => {
    mounted = await mountComponent(UiStatCard, {
      label: 'Виторг', value: '1,2 млн', valueLabel: '1 200 000 гривень',
    })
    expect(mounted.host.querySelector('.sr-only')?.textContent).toBe('1 200 000 гривень')
    const visible = [...mounted.host.querySelectorAll('span')].find((el) => el.textContent?.includes('1,2 млн'))!
    expect(visible.getAttribute('aria-hidden')).toBe('true')
  })

  it('to робить плитку посиланням', async () => {
    mounted = await mountComponent(UiStatCard, { label: 'Угоди', value: '12', to: '/deals' })
    expect(mounted.host.querySelector('a')?.getAttribute('href')).toBe('/deals')
  })
})

describe('UiAvatarGroup', () => {
  const team = Array.from({ length: 7 }, (_, index) => ({ id: index, name: `Людина ${index + 1}` }))

  it('приховані учасники лишаються названими в підписі «+N»', async () => {
    mounted = await mountComponent(UiAvatarGroup, { items: team, max: 4, label: 'Учасники' })
    const list = mounted.host.querySelector('ul')!
    expect(list.getAttribute('aria-label')).toBe('Учасники')
    // Чотири видимих плюс лічильник.
    expect(list.querySelectorAll('li')).toHaveLength(5)

    const overflow = list.querySelector('[role="img"][aria-label^="Ще"]')!
    expect(overflow.getAttribute('aria-label')).toBe('Ще 3: Людина 5, Людина 6, Людина 7')
    // Саме число для скрінрідера сховане — воно вже є в назві.
    expect(overflow.querySelector('[aria-hidden="true"]')?.textContent).toBe('+3')
  })

  it('без переповнення лічильника немає', async () => {
    mounted = await mountComponent(UiAvatarGroup, { items: team.slice(0, 3), max: 4, label: 'Учасники' })
    expect(mounted.host.querySelectorAll('li')).toHaveLength(3)
    expect(mounted.host.querySelector('[aria-label^="Ще"]')).toBeNull()
  })

  it('перший аватар лежить поверх наступних', async () => {
    mounted = await mountComponent(UiAvatarGroup, { items: team.slice(0, 3), label: 'Учасники' })
    const z = [...mounted.host.querySelectorAll('li')].map((el) => Number((el as HTMLElement).style.zIndex))
    expect(z[0]).toBeGreaterThan(z[1]!)
    expect(z[1]).toBeGreaterThan(z[2]!)
  })
})

describe('UiDescriptionList', () => {
  const items = [
    { key: 'company', term: 'Компанія', value: 'ТОВ «Сігма»' },
    { key: 'source', term: 'Джерело', value: null },
    { key: 'address', term: 'Адреса', value: 'вул. Городоцька 174', wide: true },
  ]

  it('рендерить справжні dl/dt/dd з парою в обгортці', async () => {
    mounted = await mountComponent(UiDescriptionList, { items })
    const dl = mounted.host.querySelector('dl')!
    expect(dl).not.toBeNull()
    expect(dl.querySelectorAll('dt')).toHaveLength(3)
    expect(dl.querySelectorAll('dd')).toHaveLength(3)
    // Кожна пара обгорнута — інакше grid дав би не дві колонки пар.
    expect(dl.children).toHaveLength(3)
    expect(dl.children[0]!.tagName).toBe('DIV')
  })

  it('порожнє значення друкується як emptyText, а не як порожнеча', async () => {
    mounted = await mountComponent(UiDescriptionList, { items })
    const dd = mounted.host.querySelectorAll('dd')
    expect(dd[1]!.textContent?.trim()).toBe('—')
  })

  it('wide займає обидві колонки лише в двоколонковій розкладці', async () => {
    mounted = await mountComponent(UiDescriptionList, { items, columns: 2 })
    expect(mounted.host.querySelectorAll('dl > div')[2]!.className).toContain('md:col-span-2')

    await mounted.update({ columns: 1 })
    expect(mounted.host.querySelectorAll('dl > div')[2]!.className).not.toContain('col-span-2')
  })

  it('слот value-<key> перекриває значення', async () => {
    mounted = await mountComponent(UiDescriptionList, { items }, {
      'value-company': () => h('span', { class: 'custom' }, 'Замінено'),
    })
    expect(mounted.host.querySelector('.custom')?.textContent).toBe('Замінено')
  })

  it('порожній список показує emptyText замість dl', async () => {
    mounted = await mountComponent(UiDescriptionList, { items: [], emptyText: 'Даних немає' })
    expect(mounted.host.querySelector('dl')).toBeNull()
    expect(mounted.host.textContent).toContain('Даних немає')
  })
})
