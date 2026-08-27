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
      { title: 'Roadmap', to: '/docs/roadmap' },
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
      { title: 'MultiSelect', to: '/docs/components/multi-select' },
      { title: 'Combobox', to: '/docs/components/combobox' },
      { title: 'Switch', to: '/docs/components/switch' },
      { title: 'Slider', to: '/docs/components/slider' },
      { title: 'DatePicker', to: '/docs/components/date-picker' },
      { title: 'InlineEdit', to: '/docs/components/inline-edit' },
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
    title: 'Дані',
    items: [
      { title: 'Table', to: '/docs/components/table' },
      { title: 'Menu', to: '/docs/components/menu' },
      { title: 'Pagination', to: '/docs/components/pagination' },
      { title: 'Avatar', to: '/docs/components/avatar' },
      { title: 'Tree', to: '/docs/components/tree' },
      { title: 'VirtualList', to: '/docs/components/virtual-list' },
    ],
  },
  {
    title: 'Структура',
    items: [
      { title: 'Tabs', to: '/docs/components/tabs' },
      { title: 'Breadcrumb', to: '/docs/components/breadcrumb' },
      { title: 'Card', to: '/docs/components/card' },
      { title: 'Accordion', to: '/docs/components/accordion' },
      { title: 'Stepper', to: '/docs/components/stepper' },
    ],
  },
  {
    title: 'Стани',
    items: [
      { title: 'Skeleton', to: '/docs/components/skeleton' },
      { title: 'EmptyState', to: '/docs/components/empty-state' },
      { title: 'Progress', to: '/docs/components/progress' },
      { title: 'Alert', to: '/docs/components/alert' },
      { title: 'Tooltip', to: '/docs/components/tooltip' },
    ],
  },
  {
    title: 'Дрібниці',
    items: [
      { title: 'Kbd', to: '/docs/components/kbd' },
      { title: 'CopyButton', to: '/docs/components/copy-button' },
      { title: 'ToggleGroup', to: '/docs/components/toggle-group' },
      { title: 'FileUpload', to: '/docs/components/file-upload' },
      { title: 'CommandPalette', to: '/docs/components/command-palette' },
    ],
  },
  {
    title: 'Контент',
    items: [
      { title: 'Prose', to: '/docs/components/prose' },
      { title: 'RichTextEditor', to: '/docs/components/rich-text-editor', status: 'wip' },
    ],
  },
  {
    title: 'Патерни',
    items: [{ title: 'Оверлеї та фокус', to: '/docs/patterns/overlays' }],
  },
]
