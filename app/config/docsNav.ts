export type NavStatus = 'stable' | 'beta' | 'wip'

export interface NavLink {
  title: string
  to: string
  status?: NavStatus
}

export interface NavGroup {
  title: string
  items: NavLink[]
}

/**
 * Сайдбар документації — руками, а не з дерева файлів.
 *
 * queryCollectionNavigation побудував би меню з каталогів, але тоді порядок
 * і групування диктувала б файлова структура. Тут Button має стояти в групі
 * «Дії» поруч із Chip, хоча лежить в одному каталозі з Table і Modal.
 *
 * Розбіжність між цим файлом і вмістом content/ ловить `bun run check:docs`
 * — в ОБИДВА боки: і забуте посилання, і посилання в нікуди.
 */
export const docsNav: NavGroup[] = [
  {
    title: 'Початок',
    items: [
      { title: 'Вступ', to: '/docs' },
      { title: 'Як перенести компонент', to: '/docs/copy-guide' },
    ],
  },
  {
    title: 'Основи',
    items: [
      { title: 'Токени', to: '/docs/foundations/tokens' },
      { title: 'Темна тема', to: '/docs/foundations/dark-mode' },
      { title: 'Контракт доступності', to: '/docs/foundations/a11y' },
    ],
  },
  {
    title: 'Дії',
    items: [
      { title: 'Button', to: '/docs/components/button' },
      { title: 'Chip', to: '/docs/components/chip' },
    ],
  },
  {
    title: 'Форми',
    items: [
      { title: 'Input', to: '/docs/components/input' },
      { title: 'Textarea', to: '/docs/components/textarea' },
      { title: 'Select', to: '/docs/components/select' },
      { title: 'Switch', to: '/docs/components/switch' },
    ],
  },
  {
    title: 'Оверлеї',
    items: [
      { title: 'Modal', to: '/docs/components/modal' },
      { title: 'Drawer', to: '/docs/components/drawer' },
      { title: 'ConfirmDialog', to: '/docs/components/confirm-dialog' },
      { title: 'Toast', to: '/docs/components/toast' },
    ],
  },
  {
    title: 'Стани',
    items: [
      { title: 'Skeleton', to: '/docs/components/skeleton' },
      { title: 'EmptyState', to: '/docs/components/empty-state' },
    ],
  },
  {
    title: 'Патерни',
    items: [{ title: 'Оверлеї та фокус', to: '/docs/patterns/overlays' }],
  },
]
