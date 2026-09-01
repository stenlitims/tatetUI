<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import UiCheckbox from './UiCheckbox.vue'
import UiSkeleton from './UiSkeleton.vue'
import TreeTableSettings from './tree-table/TreeTableSettings.vue'
import { useReducedMotion } from '~/composables/useReducedMotion'
import {
  keysBetween,
  selectionState,
  subtractKeys,
  unionKeys,
  type SelectionKey,
} from '~/utils/tableSelection'
import {
  branchSelection,
  cascadeSelect,
  clampWidth,
  columnsMinWidth,
  compareValues,
  flattenTree,
  indexTree,
  mergeColumnSettings,
  reconcileLazySelection,
  windowRange,
  COLUMN_DEFAULT_WIDTH,
  type StoredColumn,
  type TreeKeyIndex,
  type TreeRow,
} from '~/utils/treeTable'

export interface TreeTableHeader {
  /** Ключ поля у вузлі. Він же — суфікс іменованих слотів. */
  value: string
  text: string
  sortable?: boolean
  /** Ширина в ПІКСЕЛЯХ (число, не рядок). Для `flex` — мінімальна. */
  width?: number
  /** Колонка забирає залишок ширини. Дозволена ОДНА на таблицю. */
  flex?: boolean
  align?: 'left' | 'center' | 'right'
  /** Повна назва: підказка на заголовку і підпис у меню налаштувань. */
  title?: string
  /** Напрям ПЕРШОГО кліку по сортуванню. Типово `asc`. */
  defaultSortDir?: 'asc' | 'desc'
  /** Колонку не можна приховати. Колонка ієрархії закріплена завжди. */
  required?: boolean
  /** Заборонити ресайз. Типово можна все, крім `flex`. */
  resizable?: boolean
  visible?: boolean
}

export interface TreeTableSort {
  by: string
  dir: 'asc' | 'desc'
}

const props = withDefaults(
  defineProps<{
    /** Опис колонок. Колонка ієрархії — перша або названа в `treeColumn`. */
    headers: TreeTableHeader[]
    /** Корені дерева. Діти лежать у полі, названому в `childrenField`. */
    items: T[]
    /** Поле-ідентифікатор вузла. Значення унікальне в УСЬОМУ дереві. */
    keyRow?: string
    /** Поле з масивом дітей. `undefined` і `[]` — різні стани, див. `expand`. */
    childrenField?: string
    /** Яка колонка малює ієрархію. Типово — перша в `headers`. */
    treeColumn?: string
    /** Значення комірки й ключ сортування, коли поля лежать не на вузлі. */
    getValue?: (item: T, key: string) => unknown
    /** Чи має вузол дітей, коли їх ще не завантажено. Типово — довжина `children`. */
    hasChildren?: (item: T) => boolean
    /** Вузли, чиї діти зараз вантажаться: індикатор і `aria-busy` на рядку. */
    loadingIds?: (string | number)[]
    /** Висота рядка в ПІКСЕЛЯХ. Перекриває висоту, задану щільністю. */
    rowHeight?: number
    /** Висота картки нижче `md`, у пікселях. Той самий контракт, що `rowHeight`. */
    cardHeight?: number
    /** Висота контейнера прокрутки, напр. `"28rem"`. `"none"` знімає обмеження. */
    maxHeight?: string
    /** З якої кількості ВИДИМИХ рядків вмикати віртуалізацію. `Infinity` вимикає. */
    virtualizeFrom?: number
    /** Скільки рядків тримати відрендереними за межами вікна з кожного боку. */
    overscan?: number
    /** Відкриті гілки. Використовуйте через `v-model:expanded`. */
    expanded?: (string | number)[]
    /** Поточне сортування. Використовуйте через `v-model:sort`. */
    sort?: TreeTableSort | null
    /** Сортувати на сервері. Сервер мусить сортувати СУСІДІВ, не все дерево. */
    serverSort?: boolean
    /** Щільність рядків. Обирає висоту рядка, якщо не задано `rowHeight`. */
    density?: 'sm' | 'md'
    /** Показати перемикач щільності в меню налаштувань. */
    densityToggle?: boolean
    /** Вмикає меню налаштувань і збереження розкладки під `tree_table_settings_${tableId}`. */
    tableId?: string
    /** Версія ВАШИХ дефолтів. Змінили ширини — підніміть, і збережене скинеться. */
    settingsVersion?: number
    /** Вмикає колонку прапорців із каскадом на все піддерево. */
    selectable?: boolean
    /** Ключі обраних вузлів, включно з батьками. Використовуйте через `v-model:selected`. */
    selected?: (string | number)[]
    /** Які вузли можна обрати. Каскад незбиральних не додає. */
    selectableRow?: (item: T) => boolean
    /** Панель «Вибрано N» над таблицею. */
    selectionBar?: boolean
    /** Клік по рядку з дітьми тогглить гілку. */
    expandOnClick?: boolean
    /** Робить рядки клікабельними: курсор і подія `rowClick`. */
    rowClickable?: boolean
    /** Клас на рядок — для підсвітки. Заливка має йти в CSS після `bg-card`. */
    rowClass?: (item: T) => string | undefined
    /** Закріпити колонку ієрархії при горизонтальній прокрутці. */
    stickyTreeColumn?: boolean
    /** Нижче `md` замість таблиці — картки з відступом і шевроном. */
    mobileCards?: boolean
    /** Показує скелетони замість рядків, зберігаючи висоту таблиці. */
    loading?: boolean
    /** Скільки рядків-заглушок показати під час ПЕРШОГО завантаження. */
    skeletonRows?: number
    /** Текст, коли рядків немає. Складніший стан — слот `empty`. */
    emptyText?: string
    /** Доступна назва таблиці для скрінрідера. */
    ariaLabel?: string
  }>(),
  {
    keyRow: 'id',
    childrenField: 'children',
    loadingIds: () => [],
    cardHeight: 96,
    maxHeight: '28rem',
    virtualizeFrom: 100,
    overscan: 5,
    expanded: () => [],
    sort: null,
    density: 'md',
    densityToggle: true,
    settingsVersion: 0,
    selected: () => [],
    selectionBar: true,
    stickyTreeColumn: true,
    skeletonRows: 6,
    emptyText: 'Даних немає',
    ariaLabel: 'Дерево-таблиця',
  },
)

const emit = defineEmits<{
  'update:expanded': [ids: (string | number)[]]
  'update:selected': [keys: (string | number)[]]
  'update:sort': [value: TreeTableSort | null]
  'update:headers': [value: TreeTableHeader[]]
  expand: [payload: { item: T; id: string | number; loaded: boolean }]
  collapse: [payload: { item: T; id: string | number }]
  rowClick: [item: T]
}>()

/*
 * defineSlots із generic="T" обов'язковий: для генеричних компонентів
 * vue-component-meta не читає слоти з шаблону (language-tools#3429), і
 * таблиця API лишилася б без секції «Слоти».
 */
defineSlots<{
  /** `cell-<value>` — власний рендер комірки. Приклад: `#cell-itemsCount`. */
  [key: `cell-${string}`]: (props: { item: T; header: TreeTableHeader; depth: number }) => unknown
  /** `header-<value>` — власний рендер заголовка колонки. */
  [key: `header-${string}`]: (props: { header: TreeTableHeader }) => unknown
  /** Іконка типу вузла перед підписом у колонці ієрархії. */
  icon?: (props: { item: T; depth: number; expanded: boolean; hasChildren: boolean }) => unknown
  /** Підпис у колонці ієрархії замість значення `treeColumn`. */
  label?: (props: { item: T; depth: number; expanded: boolean; hasChildren: boolean }) => unknown
  /** Вміст картки нижче `md`, якщо стандартний список пар не підходить. */
  'mobile-card'?: (props: { item: T; depth: number }) => unknown
  /** Показується замість «Даних немає». */
  empty?: () => unknown
  /** Дії в панелі «Вибрано N». `clear` знімає виділення. */
  'selection-actions'?: (props: { selected: (string | number)[]; clear: () => void }) => unknown
}>()

type Density = NonNullable<typeof props.density>
type Align = NonNullable<TreeTableHeader['align']>

/* ---------------------------------------------------------------- */
/*  Константи                                                       */
/* ---------------------------------------------------------------- */

/** Формат збереженого payload. Піднімає САМ компонент, не споживач. */
const SETTINGS_SCHEMA = 1
/** Ширина колонки прапорців. 44px — мінімальна ціль для пальця. */
const SELECTION_COLUMN_WIDTH = 44
/**
 * Скільки id розгорнутих гілок зберігати.
 *
 * Ключ живе, доки живе браузер, а розгортання накопичується від сеансу до
 * сеансу. Без стелі сховище повзе вгору назавжди.
 */
const EXPANDED_LIMIT = 500
/*
 * Висота контейнера до першого виміру.
 *
 * Та сама формула, що й у браузері, а не окрема гілка: на сервері
 * scrollTop = 0, висота — це число, і діапазон виходить першим екраном.
 * Перший клієнтський рендер дає той самий діапазон, тож гідратація
 * проходить без розбіжностей, а справжня висота приїжджає вже після неї.
 */
const SSR_VIEWPORT = 600

/**
 * Щільність задає ЧИСЛО висоти рядка, а не паддінг.
 *
 * У звичайній таблиці висота виходить із вмісту. Тут вона множиться на
 * індекс у арифметиці вікна, тож мусить бути відома до рендеру — і
 * однаковою на сервері й клієнті. Тому адаптивної пари `{ base, md }`
 * немає: сервер не знає ширини вікна, і будь-яка спроба вгадати її
 * розійшлася б із прередереним HTML на цілі пікселі висоти.
 */
const DENSITY_ROW_HEIGHT: Record<Density, number> = { sm: 30, md: 36 }

// Літерали, а не інтерполяція: JIT Tailwind сканує вихідний код рядками.
const DENSITY_CELL: Record<Density, string> = {
  sm: 'px-2.5 text-xs',
  md: 'px-3 text-sm',
}

const ALIGN_CELL: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center justify-center',
  right: 'text-right justify-end',
}

/*
 * Роздільник рядків — псевдоелемент, а не border.
 *
 * border на <tr> чи <td> входить у висоту рядка, і кожен рядок ставав би
 * на 1px вищим за rowHeight. Арифметика вікна множить rowHeight на
 * індекс, тож розбіжність накопичується — останні екрани дерева поїхали б
 * на пів екрана вгору. З тієї ж причини таблиця — border-separate:
 * злиті межі теж діляться між сусідніми рядками і теж займають місце.
 */
const ROW_SEPARATOR =
  "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-line after:content-['']"

/**
 * Невидима зона дотику для шеврона.
 *
 * На відміну від UiButton вертикаль тут `h-full`, а не `h-12`: у рядку
 * 36px зона 45px вилізла б на 4.5px у сусідні рядки з обох боків, і тап
 * по краю рядка N+1 згортав би гілку рядка N. По горизонталі 45px
 * безпечні — ліворуч напрямні, праворуч іконка, обидві некликабельні.
 */
const CHEVRON_TOUCH =
  'pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 ' +
  'pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 ' +
  "pointer-coarse:after:content-[''] pointer-coarse:after:h-full pointer-coarse:after:w-12"

/* ---------------------------------------------------------------- */
/*  Доступ до вузла                                                 */
/* ---------------------------------------------------------------- */

const nodeId = (item: T): SelectionKey => item[props.keyRow] as SelectionKey
const nodeChildren = (item: T): T[] | undefined => item[props.childrenField] as T[] | undefined

function nodeHasChildren(item: T): boolean {
  if (props.hasChildren) return props.hasChildren(item)
  return (nodeChildren(item)?.length ?? 0) > 0
}

function cellValue(item: T, key: string): unknown {
  return props.getValue ? props.getValue(item, key) : item[key]
}

function displayValue(item: T, key: string): string {
  const value = cellValue(item, key)
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

/* ---------------------------------------------------------------- */
/*  Колонки і збережена розкладка                                   */
/* ---------------------------------------------------------------- */

const localHeaders = ref<TreeTableHeader[]>([])
const localDensity = ref<Density>(props.density)

/*
 * Збережена розкладка застосовується ЛИШЕ після монтування.
 *
 * Сторінки прередеряться, і на сервері localStorage немає. Якби клієнт
 * читав сховище вже в setup, ПЕРШИЙ його рендер не збігся б із надісланим
 * HTML: інша кількість <col>, інший порядок заголовків, а через щільність
 * ще й інша висота рядка — тобто інші розпірки й інший діапазон вікна.
 * Ціна — короткий проблиск дефолтної розкладки; уникнути його на
 * прередереній сторінці неможливо.
 */
const isMounted = ref(false)

const treeColumnValue = computed(() => props.treeColumn ?? props.headers[0]?.value ?? '')
const visibleHeaders = computed(() => localHeaders.value.filter((h) => h.visible !== false))
const showSettings = computed(() => !!props.tableId)
const densityCell = computed(() => DENSITY_CELL[localDensity.value])
const columnCount = computed(() => visibleHeaders.value.length + (props.selectable ? 1 : 0))

const rowHeightPx = computed(() => {
  const explicit = props.rowHeight
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) return explicit
  return DENSITY_ROW_HEIGHT[localDensity.value]
})

const tableMinWidth = computed(() =>
  columnsMinWidth(visibleHeaders.value, props.selectable ? SELECTION_COLUMN_WIDTH : 0),
)

interface StoredSettings {
  schema: number
  /** Версія дефолтів споживача — приходить із props.settingsVersion. */
  defaults: number
  density?: Density
  headers: StoredColumn[]
}

const settingsKey = () => `tree_table_settings_${props.tableId}`
/*
 * Розгортання живе в ОКРЕМОМУ ключі, а не в одному payload із розкладкою.
 *
 * У них різний час життя: розкладка вмирає від settingsVersion, а
 * розгортання — разом із даними. Один ключ означав би, що зміна дефолтної
 * ширини колонки заразом закриває всім користувачам усі відкриті теки.
 */
const expandedKey = () => `tree_table_expanded_${props.tableId}`

function readStorage(key: string): unknown {
  if (!isMounted.value || typeof localStorage === 'undefined' || !props.tableId) return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStorage(key: string, value: unknown) {
  if (typeof localStorage === 'undefined' || !props.tableId) return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Квота або приватний режим — не привід валити обробник кліку.
  }
}

function loadSettings(): StoredSettings | null {
  const parsed = readStorage(settingsKey()) as Partial<StoredSettings> | null
  if (!parsed || !Array.isArray(parsed.headers)) return null

  // Споживач змінив свої дефолти — збережене більше не описує ту саму
  // таблицю, і тримати його означало б показувати чужу розкладку.
  if ((parsed.defaults ?? 0) !== props.settingsVersion) return null

  // Старий формат payload. Порядок і видимість — вибір КОРИСТУВАЧА,
  // лишаємо; ширини й щільність належать компоненту — скидаємо.
  if (parsed.schema !== SETTINGS_SCHEMA) {
    return {
      schema: SETTINGS_SCHEMA,
      defaults: props.settingsVersion,
      headers: parsed.headers.map((h) => ({ value: h.value, visible: h.visible })),
    }
  }
  return parsed as StoredSettings
}

function saveSettings() {
  writeStorage(settingsKey(), {
    schema: SETTINGS_SCHEMA,
    defaults: props.settingsVersion,
    density: localDensity.value,
    headers: localHeaders.value.map((h) => ({
      value: h.value,
      width: h.width,
      visible: h.visible,
    })),
  } satisfies StoredSettings)
}

function commitHeaders() {
  saveSettings()
  emit('update:headers', localHeaders.value)
}

function reconcile(incoming: TreeTableHeader[]) {
  const settings = loadSettings()
  localDensity.value = settings?.density ?? props.density
  localHeaders.value = mergeColumnSettings(
    incoming,
    settings?.headers ?? null,
    treeColumnValue.value,
  )
}

// tableId у джерелах watch обов'язковий: його часто передають динамічно
// (`shop-${id}`) при сталих headers — без цього наступна сутність
// відкривалася б із розкладкою попередньої.
watch(
  [() => props.headers, () => props.tableId, isMounted],
  ([incoming]) => reconcile(incoming as TreeTableHeader[]),
  { immediate: true, deep: true },
)

/* ---------------------------------------------------------------- */
/*  Розгорнуті гілки                                                */
/* ---------------------------------------------------------------- */

const expandedIds = ref<Set<SelectionKey>>(new Set(props.expanded))

watch(
  () => props.expanded,
  (ids) => {
    const next = new Set<SelectionKey>(ids)
    if (next.size !== expandedIds.value.size || [...next].some((id) => !expandedIds.value.has(id))) {
      expandedIds.value = next
    }
  },
)

function emitExpanded() {
  emit('update:expanded', [...expandedIds.value])
}

function persistExpanded() {
  if (!props.tableId) return
  writeStorage(expandedKey(), [...expandedIds.value].slice(-EXPANDED_LIMIT))
}

/*
 * Відновлене розгортання перекриває props.expanded — і це навмисно.
 *
 * Споживач передає початковий стан, користувач передає свій. Якби
 * вигравав props, збережене відкривалося б і миттєво закривалося на
 * кожному переході, тобто ключ був би записаний, але не прочитаний.
 */
watch([() => props.tableId, isMounted], () => {
  if (!isMounted.value || !props.tableId) return
  const stored = readStorage(expandedKey())
  if (!Array.isArray(stored) || !stored.length) return
  expandedIds.value = new Set(stored as SelectionKey[])
  emitExpanded()
})

function setExpanded(row: TreeRow<T>, next: boolean, silent = false) {
  const ids = new Set(expandedIds.value)
  if (next) {
    if (ids.has(row.id)) return
    ids.add(row.id)
    // `loaded` рятує споживача від повторного визначення того, що
    // компонент уже знає: undefined у children — діти ще не приїхали.
    emit('expand', { item: row.item, id: row.id, loaded: nodeChildren(row.item) !== undefined })
  } else {
    if (!ids.has(row.id)) return
    ids.delete(row.id)
    emit('collapse', { item: row.item, id: row.id })
  }
  expandedIds.value = ids
  if (silent) return
  emitExpanded()
  persistExpanded()
}

function toggle(row: TreeRow<T>) {
  setExpanded(row, !expandedIds.value.has(row.id))
}

/** APG treegrid: `*` розкриває всіх сусідів поточного рівня. */
function expandSiblings(row: TreeRow<T>) {
  for (const candidate of flatRows.value) {
    if (candidate.depth !== row.depth) continue
    if (candidate.parentId !== row.parentId) continue
    if (!candidate.hasChildren) continue
    setExpanded(candidate, true, true)
  }
  emitExpanded()
  persistExpanded()
}

function walkTree(nodes: T[], visit: (item: T) => void) {
  for (const item of nodes) {
    visit(item)
    const children = nodeChildren(item)
    if (children?.length) walkTree(children, visit)
  }
}

function expandAll() {
  const ids = new Set<SelectionKey>()
  walkTree(props.items, (item) => {
    if (nodeHasChildren(item)) ids.add(nodeId(item))
  })
  expandedIds.value = ids
  emitExpanded()
  persistExpanded()
}

function collapseAll() {
  expandedIds.value = new Set()
  emitExpanded()
  persistExpanded()
}

/* ---------------------------------------------------------------- */
/*  Сортування                                                      */
/* ---------------------------------------------------------------- */

const internalSort = ref<TreeTableSort | null>(props.sort)
watch(
  () => props.sort,
  (value) => {
    internalSort.value = value ?? null
  },
)

const comparator = computed(() => {
  const sort = internalSort.value
  if (!sort || props.serverSort) return null
  const direction = sort.dir === 'asc' ? 1 : -1
  return (a: T, b: T) => compareValues(cellValue(a, sort.by), cellValue(b, sort.by), direction)
})

function toggleSort(header: TreeTableHeader) {
  if (!header.sortable) return
  const current = internalSort.value
  let next: TreeTableSort | null
  if (current?.by !== header.value) next = { by: header.value, dir: header.defaultSortDir ?? 'asc' }
  else if (current.dir === (header.defaultSortDir ?? 'asc'))
    next = { by: header.value, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  // Третій клік скидає сортування — інакше повернутися до вихідного
  // порядку можна лише перезавантаженням сторінки.
  else next = null

  internalSort.value = next
  emit('update:sort', next)
}

function ariaSort(header: TreeTableHeader): 'ascending' | 'descending' | 'none' | undefined {
  if (!header.sortable) return undefined
  if (internalSort.value?.by !== header.value) return 'none'
  return internalSort.value.dir === 'asc' ? 'ascending' : 'descending'
}

/* ---------------------------------------------------------------- */
/*  Плоский зріз і вікно                                            */
/* ---------------------------------------------------------------- */

const flatRows = computed<TreeRow<T>[]>(() =>
  flattenTree(props.items, {
    getId: nodeId,
    getChildren: nodeChildren,
    hasChildren: nodeHasChildren,
    isExpanded: (id) => expandedIds.value.has(id),
    compare: comparator.value,
  }),
)

const loadingSet = computed(() => new Set<SelectionKey>(props.loadingIds))

/*
 * Поріг — це кількість рядків, і саме тому він безпечний.
 *
 * Порівняння props із даними однакове на сервері й клієнті. Поставити
 * віртуалізацію в залежність від isMounted чи matchMedia означало б
 * рендерити на сервері одне тіло таблиці, а в першому клієнтському
 * рендері — інше.
 */
const isVirtual = computed(() => flatRows.value.length >= props.virtualizeFrom)

const scrollEl = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const scrollLeft = ref(0)
const viewportWidth = ref(0)
const cardEl = ref<HTMLElement | null>(null)
const cardScrollTop = ref(0)

/*
 * null — ще не міряли (SSR і перший клієнтський рендер);
 * 0 — ResizeObserver віддав нульовий бокс, тобто контейнер під
 *     display:none, і рендерити в ньому нічого не треба;
 * > 0 — справжня висота.
 *
 * Нуль — ОКРЕМИЙ стан, а не менша висота. Саме через це розкладку для
 * мобільних карток обирає CSS, а не JS: обидва контейнери є в DOM, і той,
 * що прихований, спорожнюється виміром, а не брейкпойнтом.
 */
const tableMeasured = shallowRef<number | null>(null)
const cardMeasured = shallowRef<number | null>(null)

const viewportHeight = computed(() => tableMeasured.value ?? SSR_VIEWPORT)
const cardViewportHeight = computed(() => cardMeasured.value ?? SSR_VIEWPORT)

const fullRange = computed(() => ({
  start: 0,
  end: flatRows.value.length - 1,
  topPad: 0,
  bottomPad: 0,
}))

const range = computed(() =>
  isVirtual.value
    ? windowRange(
        flatRows.value.length,
        rowHeightPx.value,
        scrollTop.value,
        viewportHeight.value,
        props.overscan,
      )
    : fullRange.value,
)

const cardRange = computed(() =>
  isVirtual.value
    ? windowRange(
        flatRows.value.length,
        props.cardHeight,
        cardScrollTop.value,
        cardViewportHeight.value,
        props.overscan,
      )
    : fullRange.value,
)

const visibleRows = computed(() => flatRows.value.slice(range.value.start, range.value.end + 1))
const visibleCards = computed(() =>
  flatRows.value.slice(cardRange.value.start, cardRange.value.end + 1),
)

/*
 * Без ResizeObserver нуль трактується як «не міряли».
 *
 * Нуль означає «контейнер прихований» ЛИШЕ там, де є хто повідомити про
 * зворотну зміну. У середовищі без ResizeObserver (happy-dom, старі
 * рушії) clientHeight дорівнює нулю завжди, і довіра до нього дала б
 * назавжди порожню таблицю. Зайві рядки — краща помилка.
 */
const hasResizeObserver = typeof ResizeObserver !== 'undefined'

function measureTable() {
  const el = scrollEl.value
  if (!el) return
  scrollTop.value = el.scrollTop
  scrollLeft.value = el.scrollLeft
  viewportWidth.value = el.clientWidth
  if (el.clientHeight > 0 || hasResizeObserver) tableMeasured.value = el.clientHeight
}

function measureCards() {
  const el = cardEl.value
  if (!el) return
  cardScrollTop.value = el.scrollTop
  if (el.clientHeight > 0 || hasResizeObserver) cardMeasured.value = el.clientHeight
}

const canScrollLeft = computed(() => scrollLeft.value > 1)
const canScrollRight = computed(
  () => tableMinWidth.value - viewportWidth.value - scrollLeft.value > 1,
)

let observer: ResizeObserver | null = null

onMounted(() => {
  isMounted.value = true
  void nextTick(() => {
    measureTable()
    measureCards()
  })
  /*
   * ResizeObserver, а не лише window.resize: згортання сайдбара міняє
   * ширину контейнера без жодної події вікна, а перемикання мобільної
   * розкладки міняє висоту прихованого контейнера на нуль — теж без неї.
   */
  if (hasResizeObserver) {
    observer = new ResizeObserver(() => {
      measureTable()
      measureCards()
    })
    if (scrollEl.value) observer.observe(scrollEl.value)
    if (cardEl.value) observer.observe(cardEl.value)
  }
  window.addEventListener('resize', measureTable, { passive: true })
  window.addEventListener('resize', measureCards, { passive: true })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  if (typeof document === 'undefined') return
  window.removeEventListener('resize', measureTable)
  window.removeEventListener('resize', measureCards)
})

function maxScrollTop() {
  return Math.max(0, flatRows.value.length * rowHeightPx.value - viewportHeight.value)
}

/*
 * Позиція КЛАМИТЬСЯ, а не скидається в нуль, як у UiVirtualList.
 *
 * Там набір items міняється цілком, і стара позиція нічого не означає.
 * Тут згортання однієї гілки в дереві на пів тисячі рядків лишає решту
 * на місці: телепорт на початок був би гіршим багом за той, який
 * скидання лікує.
 */
watch([() => flatRows.value.length, rowHeightPx], () => {
  const el = scrollEl.value
  if (!el) return
  const max = maxScrollTop()
  if (el.scrollTop > max) {
    el.scrollTop = max
    scrollTop.value = max
  }
})

/* ---------------------------------------------------------------- */
/*  Клавіатура: roving tabindex по видимих рядах                    */
/* ---------------------------------------------------------------- */

/*
 * Посилання на рядки ключуються ID, а не індексом.
 *
 * Індексований масив, як у UiTree, ламається щойно індекс перестає
 * збігатися з позицією у зрізі — тобто з першою ж прокруткою. Функція-ref
 * сама прибирає за собою: Vue викликає її з null при демонтажі рядка.
 */
const rowEls = new Map<SelectionKey, HTMLElement>()

function setRowEl(id: SelectionKey, el: unknown) {
  if (el) rowEls.set(id, el as HTMLElement)
  else rowEls.delete(id)
}

const activeId = shallowRef<SelectionKey | null>(null)

watch(
  flatRows,
  (rows) => {
    if (activeId.value !== null && rows.some((row) => row.id === activeId.value)) return
    activeId.value = rows[0]?.id ?? null
  },
  { immediate: true },
)

const prefersReducedMotion = useReducedMotion()

function clampScrollTop(value: number) {
  return Math.min(maxScrollTop(), Math.max(0, value))
}

function focusRow(index: number) {
  const row = flatRows.value[index]
  if (!row) return
  activeId.value = row.id

  /*
   * Рядок за межами вікна ще НЕ існує в DOM, і focus() по ньому — no-op.
   *
   * Вікно зсувається ПРИСВОЄННЯМ scrollTop.value, а не через
   * el.scrollTo(): подія scroll прилетіла б лише наступним кадром, а
   * діапазон рахується від scrollTop.value — тобто саме присвоєння
   * синхронно вводить рядок у рендер. Анімації тут теж немає: focus()
   * посеред плавної прокрутки скасовує її, і рядок лишається за кадром.
   */
  if (isVirtual.value && (index < range.value.start || index > range.value.end)) {
    const top = clampScrollTop(index * rowHeightPx.value - (viewportHeight.value - rowHeightPx.value) / 2)
    scrollTop.value = top
    if (scrollEl.value) scrollEl.value.scrollTop = top
  }

  // preventScroll обов'язковий: без нього браузер сам доскролює до рядка
  // і б'ється з нашим scrollTop — видно як подвійний стрибок.
  void nextTick(() => rowEls.get(row.id)?.focus({ preventScroll: true }))
}

function onRowKeydown(event: KeyboardEvent, row: TreeRow<T>) {
  const last = flatRows.value.length - 1
  const page = Math.max(1, Math.floor(viewportHeight.value / rowHeightPx.value) - 1)

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      focusRow(Math.min(last, row.index + 1))
      return
    case 'ArrowUp':
      event.preventDefault()
      focusRow(Math.max(0, row.index - 1))
      return
    case 'PageDown':
      event.preventDefault()
      focusRow(Math.min(last, row.index + page))
      return
    case 'PageUp':
      event.preventDefault()
      focusRow(Math.max(0, row.index - page))
      return
    case 'Home':
      event.preventDefault()
      focusRow(0)
      return
    case 'End':
      event.preventDefault()
      focusRow(last)
      return
    case 'ArrowRight':
      event.preventDefault()
      if (row.hasChildren && !row.expanded) setExpanded(row, true)
      else if (row.hasChildren && row.index < last) focusRow(row.index + 1)
      return
    case 'ArrowLeft':
      event.preventDefault()
      // parentIndex порахований у обході: без нього тут був би пошук по
      // всьому списку на кожне натискання при автоповторі.
      if (row.hasChildren && row.expanded) setExpanded(row, false)
      else if (row.parentIndex >= 0) focusRow(row.parentIndex)
      return
    case '*':
      event.preventDefault()
      expandSiblings(row)
      return
    case 'Enter':
      event.preventDefault()
      activate(row)
      return
    case ' ':
      // Space без preventDefault прокручує контейнер замість дії.
      event.preventDefault()
      if (props.selectable) toggleRow(row, !rowSelection(row).checked)
      else activate(row)
  }
}

function activate(row: TreeRow<T>) {
  if (props.rowClickable) emit('rowClick', row.item)
  else if (row.hasChildren) toggle(row)
}

function onRowClick(row: TreeRow<T>) {
  activeId.value = row.id
  if (props.expandOnClick && row.hasChildren) toggle(row)
  if (props.rowClickable) emit('rowClick', row.item)
}

/* ---------------------------------------------------------------- */
/*  Каскадне виділення                                              */
/* ---------------------------------------------------------------- */

/*
 * Індекс піддерев будується лише за увімкненого виділення: це повний
 * обхід дерева, включно зі згорнутими гілками, і платити за нього там,
 * де прапорців немає, немає за що.
 */
const selectionIndex = computed<TreeKeyIndex | null>(() =>
  props.selectable ? indexTree(props.items, { getId: nodeId, getChildren: nodeChildren }) : null,
)

const nodeById = computed(() => {
  const map = new Map<SelectionKey, T>()
  if (props.selectable && props.selectableRow) {
    walkTree(props.items, (item) => map.set(nodeId(item), item))
  }
  return map
})

function canSelectId(id: SelectionKey) {
  if (!props.selectableRow) return true
  const item = nodeById.value.get(id)
  return item ? props.selectableRow(item) : false
}

const selectedSet = computed(() => new Set<SelectionKey>(props.selected))
const selectedCount = computed(() => props.selected.length)

/*
 * «Обрати всі» рахується по ВСЬОМУ дереву, а не по видимих рядках.
 *
 * У UiTable «сторінка» дорівнює видимому, бо там видиме і є весь набір.
 * У дереві прив'язка до видимого зробила б сенс прапорця залежним від
 * того, які теки випадково відкриті: та сама галочка означала б різне до
 * і після розгортання гілки.
 */
const allSelectableKeys = computed(() => {
  const index = selectionIndex.value
  if (!index) return []
  return props.selectableRow ? index.all.filter(canSelectId) : index.all
})

const headerSelection = computed(() =>
  selectionState(allSelectableKeys.value, selectedSet.value),
)

function rowSelection(row: TreeRow<T>) {
  const index = selectionIndex.value
  if (!index) return { checked: false, indeterminate: false }
  return branchSelection(index, row.id, selectedSet.value)
}

function toggleAll(next: boolean) {
  const keys = allSelectableKeys.value
  emit(
    'update:selected',
    next ? unionKeys(props.selected, keys) : subtractKeys(props.selected, keys),
  )
}

/*
 * UiCheckbox емітить `update:modelValue: [boolean]` без об'єкта події,
 * тож shiftKey звідти не дістати. Ловимо його на комірці, поки
 * натискання ще не перетворилось на зміну.
 */
const pendingShift = shallowRef(false)
let selectionAnchor: SelectionKey | null = null

function toggleRow(row: TreeRow<T>, next: boolean) {
  const index = selectionIndex.value
  if (!index || !canSelectId(row.id)) return

  if (pendingShift.value && selectionAnchor !== null) {
    // Порядок ПОКАЗУ, а не порядок даних: Shift виділяє те, що видно між
    // двома рядками — з урахуванням сортування й згорнутих гілок.
    const ordered = flatRows.value.filter((r) => canSelectId(r.id)).map((r) => r.id)
    const rangeKeys = keysBetween(ordered, selectionAnchor, row.id)
    emit(
      'update:selected',
      next ? unionKeys(props.selected, rangeKeys) : subtractKeys(props.selected, rangeKeys),
    )
  } else {
    selectionAnchor = row.id
    emit('update:selected', cascadeSelect(props.selected, index, row.id, next, canSelectId))
  }
  pendingShift.value = false
}

function clearSelection() {
  selectionAnchor = null
  if (props.selected.length) emit('update:selected', [])
}

/*
 * Доливання щойно завантажених нащадків до вже позначених гілок.
 *
 * У лінивому режимі тека позначається тоді, коли її дітей ще немає.
 * Без цього кроку розгортання показало б непозначених дітей під
 * позначеним батьком. reconcile ідемпотентний і повертає ВХІДНИЙ масив,
 * коли додавати нічого — тож порівняння по посиланню гасить цикл.
 */
watch([selectionIndex, () => props.selected], () => {
  const index = selectionIndex.value
  if (!index || !props.selected.length) return
  const next = reconcileLazySelection(props.selected, index, canSelectId)
  if (next !== props.selected) emit('update:selected', next)
})

/** Доступне ім'я прапорця рядка. Голе «Обрати рядок» нічого не розрізняє. */
function rowSelectionLabel(row: TreeRow<T>): string {
  return `Обрати гілку ${displayValue(row.item, treeColumnValue.value)}`
}

/* ---------------------------------------------------------------- */
/*  Ресайз колонок                                                  */
/* ---------------------------------------------------------------- */

const resizing = ref<{ value: string; startX: number; startWidth: number } | null>(null)

function isResizable(header: TreeTableHeader) {
  return (header.resizable ?? true) && !header.flex
}

function patchHeader(value: string, patch: Partial<TreeTableHeader>) {
  const index = localHeaders.value.findIndex((h) => h.value === value)
  if (index === -1) return
  localHeaders.value[index] = { ...localHeaders.value[index]!, ...patch }
}

function onResizeStart(event: PointerEvent, header: TreeTableHeader) {
  if (!isResizable(header)) return
  // Без цього pointerdown на хваті долетить до кнопки сортування в тому
  // самому <th>, і кожен ресайз перемикав би сортування.
  event.preventDefault()
  event.stopPropagation()
  try {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  } catch {
    // Захоплення — оптимізація, а не умова роботи.
  }
  resizing.value = {
    value: header.value,
    startX: event.clientX,
    startWidth: header.width ?? COLUMN_DEFAULT_WIDTH,
  }
}

function onResizeMove(event: PointerEvent) {
  const state = resizing.value
  if (!state) return
  patchHeader(state.value, { width: clampWidth(state.startWidth + (event.clientX - state.startX)) })
}

function onResizeEnd() {
  if (!resizing.value) return
  resizing.value = null
  // Один запис у localStorage на весь жест, а не на кожен pointermove.
  commitHeaders()
}

function resetWidth(header: TreeTableHeader) {
  const original = props.headers.find((h) => h.value === header.value)
  patchHeader(header.value, { width: original?.width ?? COLUMN_DEFAULT_WIDTH })
  commitHeaders()
}

function onSettingsHeaders(next: TreeTableHeader[]) {
  localHeaders.value = next
  commitHeaders()
}

function onSettingsDensity(next: Density) {
  localDensity.value = next
  saveSettings()
}

function resetAll() {
  if (typeof localStorage !== 'undefined' && props.tableId) {
    try {
      localStorage.removeItem(settingsKey())
    } catch {
      // див. writeStorage
    }
  }
  localDensity.value = props.density
  reconcile(props.headers)
  emit('update:headers', localHeaders.value)
}

/* ---------------------------------------------------------------- */
/*  Стан порожнечі                                                  */
/* ---------------------------------------------------------------- */

const showSkeleton = computed(() => props.loading && props.items.length === 0)
const showEmpty = computed(() => !props.loading && flatRows.value.length === 0)

function alignClass(header: TreeTableHeader) {
  return ALIGN_CELL[header.align ?? 'left']
}

/** Відступ картки: та сама глибина, але без напрямних — на 375px вони зайві. */
function cardIndent(depth: number) {
  return { paddingLeft: `${depth * 1 + 0.75}rem` }
}

function scrollToIndex(index: number) {
  const el = scrollEl.value
  if (!el || !flatRows.value.length) return
  const normalized = Math.min(
    flatRows.value.length - 1,
    Math.max(0, Math.floor(Number.isFinite(index) ? index : 0)),
  )
  const top = clampScrollTop(
    normalized * rowHeightPx.value - viewportHeight.value / 2 + rowHeightPx.value / 2,
  )
  scrollTop.value = top
  el.scrollTo({ top, behavior: prefersReducedMotion.value ? 'auto' : 'smooth' })
}

function scrollToKey(key: string | number) {
  const index =
    selectionIndex.value ?? indexTree(props.items, { getId: nodeId, getChildren: nodeChildren })
  const chain = index.ancestors.get(key)
  if (!chain) return false
  if (chain.length) {
    const ids = new Set(expandedIds.value)
    for (const id of chain) ids.add(id)
    expandedIds.value = ids
    emitExpanded()
    persistExpanded()
  }
  void nextTick(() => {
    const at = flatRows.value.findIndex((row) => row.id === key)
    if (at >= 0) focusRow(at)
  })
  return true
}

defineExpose({
  /** Прокрутити до рядка за номером у ПЛОСКОМУ списку видимих рядків. */
  scrollToIndex,
  /** Розгорнути предків вузла і перейти до нього. `false`, якщо вузла немає. */
  scrollToKey,
  /** Розгорнути всі гілки. Повний обхід дерева — дорого на великих даних. */
  expandAll,
  /** Згорнути всі гілки. */
  collapseAll,
  /** Зняти виділення. Потрібне після успішної масової дії. */
  clearSelection,
})
</script>

<template>
  <!--
    w-full + min-w-0 на корені обов'язкові, а не косметика.

    Таблиця має інлайновий min-width (сума ширин колонок), і горизонтальну
    прокрутку бере на себе контейнер із overflow-auto. Але у flex- або
    grid-батька цей корінь стає елементом з min-width: auto, тобто
    відмовляється стискатись вужче за власний min-content — а той тягнеться
    саме з min-width таблиці. Контейнер прокрутки при цьому не спрацьовує
    жодного разу: стискатись нема чому. Виміряно на сторінці документації,
    де сцена демо — flex із justify-center: корінь ставав ширшим за сцену і
    вилазив ПОРІВНУ з обох боків, а зовнішній overflow-hidden обрізав і
    ліву, і праву частину.
  -->
  <div class="w-full min-w-0" :class="{ 'select-none': !!resizing || selectable }">
    <!--
      Панель ЗОВНІ контейнера з overflow-auto: усередині нього вона з'їхала
      б горизонтально разом із таблицею і зникла б з очей рівно тоді, коли
      користувач прокрутив до колонки, заради якої й виділяв гілки.
    -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="-translate-y-1 opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-if="selectable && selectionBar && selectedCount > 0"
        class="mb-2 flex flex-wrap items-center gap-3 rounded-card border border-accent-solid bg-primary-50 px-3 py-2"
      >
        <p class="text-sm font-medium text-accent" role="status" aria-live="polite">
          Вибрано {{ selectedCount }}
        </p>
        <div class="ml-auto flex flex-wrap items-center gap-2">
          <slot name="selection-actions" :selected="props.selected" :clear="clearSelection" />
          <button
            type="button"
            class="rounded-control px-2.5 py-1.5 text-sm text-accent transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="clearSelection"
          >
            Зняти вибір
          </button>
        </div>
      </div>
    </Transition>

    <div v-if="showSettings" class="mb-2 flex items-center justify-end">
      <TreeTableSettings
        :headers="localHeaders"
        :density="localDensity"
        :density-toggle="densityToggle"
        :pinned="treeColumnValue"
        @update:headers="onSettingsHeaders"
        @update:density="onSettingsDensity"
        @reset="resetAll"
      />
    </div>

    <div class="relative">
      <div
        ref="scrollEl"
        class="scrollbar-thin relative overflow-auto rounded-card border border-line bg-card"
        :class="mobileCards ? 'hidden md:block' : ''"
        :style="maxHeight === 'none' ? undefined : { maxHeight }"
        @scroll.passive="measureTable"
      >
        <!--
          border-separate, а НЕ border-collapse: злиті межі діляться між
          сусідніми рядками й входять у їхню висоту, а вікно множить
          висоту рядка на індекс. Заразом це знімає давню проблему з
          position: sticky на комірках зліпленої таблиці.

          Нульовий інтервал заданий інлайново, а не класом
          border-spacing-0: аудит стилів у check:docs читає будь-яке
          `border-*` як колірну утиліту й шукає токен «spacing-0».
          Послабити аудит заради одного класу — гірша угода, ніж три
          слова в тому ж :style, де вже живуть tableLayout і minWidth.
        -->
        <table
          role="treegrid"
          :aria-label="ariaLabel"
          :aria-rowcount="flatRows.length + 1"
          :aria-busy="loading || undefined"
          :aria-multiselectable="selectable || undefined"
          class="w-full border-separate"
          :style="{ tableLayout: 'fixed', minWidth: `${tableMinWidth}px`, borderSpacing: '0' }"
        >
          <!--
            Ширини живуть ТУТ, а не на кожній комірці. За table-layout:
            fixed враховується лише перший рядок, тож інлайновий width на
            кожному <td> був би мертвим стилем, помноженим на кількість
            рядків. Колонка без width (flex) забирає залишок.
          -->
          <colgroup>
            <col v-if="selectable" :style="{ width: '44px' }" />
            <col
              v-for="header in visibleHeaders"
              :key="header.value"
              :style="header.flex ? undefined : { width: `${header.width ?? 120}px` }"
            />
          </colgroup>

          <thead>
            <tr>
              <th
                v-if="selectable"
                scope="col"
                class="sticky top-0 z-20 border-b border-line bg-subtle px-2 py-2"
              >
                <UiCheckbox
                  :model-value="headerSelection === 'all'"
                  :indeterminate="headerSelection === 'some'"
                  :disabled="!allSelectableKeys.length"
                  class="w-5"
                  @update:model-value="toggleAll($event)"
                >
                  <span class="sr-only">Обрати всі вузли дерева</span>
                </UiCheckbox>
              </th>
              <th
                v-for="header in visibleHeaders"
                :key="header.value"
                scope="col"
                :aria-sort="ariaSort(header)"
                :title="header.title"
                class="relative border-b border-line bg-subtle py-2 font-medium text-muted"
                :class="[
                  densityCell,
                  alignClass(header),
                  header.value === treeColumnValue && stickyTreeColumn
                    ? 'sticky left-0 top-0 z-30'
                    : 'sticky top-0 z-20',
                ]"
              >
                <slot :name="`header-${header.value}`" :header="header">
                  <button
                    v-if="header.sortable"
                    type="button"
                    class="group inline-flex max-w-full items-center gap-1 rounded-control transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    @click="toggleSort(header)"
                  >
                    <span class="truncate">{{ header.text }}</span>
                    <!-- Привид-шеврон: підказка, що колонка сортується. -->
                    <svg
                      class="h-3 w-3 shrink-0 transition-opacity"
                      :class="
                        internalSort?.by === header.value
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-40 group-focus-visible:opacity-40'
                      "
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        :d="
                          internalSort?.by === header.value && internalSort.dir === 'desc'
                            ? 'M6 9l6 6 6-6'
                            : 'M6 15l6-6 6 6'
                        "
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                  <span v-else class="block truncate">{{ header.text }}</span>
                </slot>

                <!-- Хват ресайзу. touch-none обов'язковий: без нього
                     браузер забирає горизонтальний жест собі. -->
                <span
                  v-if="isResizable(header)"
                  class="absolute inset-y-0 right-0 w-1.5 cursor-col-resize touch-none hover:bg-accent/40"
                  :class="resizing?.value === header.value ? 'bg-accent/60' : ''"
                  @pointerdown="onResizeStart($event, header)"
                  @pointermove="onResizeMove"
                  @pointerup="onResizeEnd"
                  @pointercancel="onResizeEnd"
                  @dblclick.stop="resetWidth(header)"
                  @click.stop
                />
              </th>
            </tr>
          </thead>

          <tbody>
            <!--
              v-if і v-for навмисно РОЗНЕСЕНІ по різних вузлах. На одному
              елементі у Vue 3 v-if має вищий пріоритет і не бачить
              змінної циклу.
            -->
            <template v-if="showSkeleton">
              <tr v-for="row in skeletonRows" :key="`sk-${row}`">
                <td v-if="selectable" class="relative px-2" :class="ROW_SEPARATOR">
                  <div class="flex items-center" :style="{ height: `${rowHeightPx}px` }">
                    <UiSkeleton class="h-4 w-4 rounded-control" />
                  </div>
                </td>
                <td
                  v-for="header in visibleHeaders"
                  :key="header.value"
                  class="relative"
                  :class="[densityCell, ROW_SEPARATOR]"
                >
                  <div class="flex items-center" :style="{ height: `${rowHeightPx}px` }">
                    <!-- Ширина заглушки детермінована, а не Math.random():
                         інакше вона мінялась би на кожному рендері. -->
                    <UiSkeleton
                      class="h-3"
                      :style="{ width: `${55 + ((row * 17 + header.value.length * 13) % 40)}%` }"
                    />
                  </div>
                </td>
              </tr>
            </template>

            <tr v-else-if="showEmpty">
              <td :colspan="columnCount" class="p-0">
                <slot name="empty">
                  <p class="px-4 py-10 text-center text-sm text-muted">{{ emptyText }}</p>
                </slot>
              </td>
            </tr>

            <template v-else>
              <!-- Розпірки замість абсолютного позиціювання: абсолютний
                   <tr> вибиває рядок із табличного боксу, і <colgroup>
                   перестає керувати ширинами. -->
              <tr v-if="range.topPad > 0" aria-hidden="true" :style="{ height: `${range.topPad}px` }">
                <td :colspan="columnCount" class="p-0" />
              </tr>

              <tr
                v-for="row in visibleRows"
                :key="String(row.id)"
                :ref="(el) => setRowEl(row.id, el)"
                :tabindex="row.id === activeId ? 0 : -1"
                :aria-level="row.depth + 1"
                :aria-posinset="row.posinset"
                :aria-setsize="row.setsize"
                :aria-rowindex="row.index + 2"
                :aria-expanded="row.hasChildren ? row.expanded : undefined"
                :aria-selected="selectable ? rowSelection(row).checked : undefined"
                :aria-busy="loadingSet.has(row.id) || undefined"
                class="focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                :class="[
                  rowSelection(row).checked ? 'bg-primary-50' : 'bg-card hover:bg-hover',
                  rowClickable || expandOnClick ? 'cursor-pointer' : '',
                  rowClass?.(row.item),
                ]"
                @click="onRowClick(row)"
                @keydown="onRowKeydown($event, row)"
              >
                <!-- @click.stop обов'язковий: без нього перемикання
                     прапорця ще й «активує» рядок. -->
                <td
                  v-if="selectable"
                  class="relative bg-inherit px-2"
                  :class="ROW_SEPARATOR"
                  role="gridcell"
                  @click.stop
                  @pointerdown="pendingShift = $event.shiftKey"
                >
                  <div class="flex items-center" :style="{ height: `${rowHeightPx}px` }">
                    <UiCheckbox
                      :model-value="rowSelection(row).checked"
                      :indeterminate="rowSelection(row).indeterminate"
                      :disabled="!canSelectId(row.id)"
                      class="w-5"
                      @update:model-value="toggleRow(row, $event)"
                    >
                      <span class="sr-only">{{ rowSelectionLabel(row) }}</span>
                    </UiCheckbox>
                  </div>
                </td>

                <td
                  v-for="header in visibleHeaders"
                  :key="header.value"
                  :role="header.value === treeColumnValue ? 'rowheader' : 'gridcell'"
                  class="relative bg-inherit"
                  :class="[
                    densityCell,
                    ROW_SEPARATOR,
                    header.value === treeColumnValue && stickyTreeColumn ? 'sticky left-0 z-10' : '',
                  ]"
                >
                  <!-- Висота задається ТУТ, а не на <tr>: height на рядку
                       таблиці — це мінімум, і будь-який вміст слота
                       роздув би рядок, зламавши арифметику вікна. -->
                  <div
                    v-if="header.value === treeColumnValue"
                    class="flex items-center overflow-hidden"
                    :style="{ height: `${rowHeightPx}px` }"
                  >
                    <!--
                      УСІ колонки ієрархії однакової ширини (w-5), і це не
                      косметика. Коліно займає колонку БАТЬКА, а не власну
                      додаткову, тож вертикаль дитини лягає рівно під центр
                      шеврона батька. Коли напрямні були по 8px, коліно 20px,
                      а шеврон ще 20px, кожен рівень зсувався на пів колонки
                      — лінії підходили до папок повз них.
                    -->
                    <span
                      v-for="(line, level) in row.guides"
                      :key="level"
                      class="relative h-full w-5 shrink-0"
                      aria-hidden="true"
                    >
                      <span v-if="line" class="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-line" />
                    </span>

                    <!-- Коліно. Нижня половина — лише за наявності
                         наступного сусіда, інакше драбина рветься між
                         сусідніми рядками. -->
                    <span
                      v-if="row.depth > 0"
                      class="relative h-full w-5 shrink-0"
                      aria-hidden="true"
                    >
                      <!--
                        -translate-x-1/2 на КОЖНІЙ вертикалі обов'язковий.
                        Без нього left-1/2 ставить на центр колонки лівий
                        КРАЙ лінії, а не її середину, і вся драбина стоїть
                        на пів пікселя правіше за шеврони. На екрані 1x це
                        півпікселя округлюється в сусідній стовпчик — лінія
                        видимо промахується повз папку.
                      -->
                      <span class="absolute bottom-1/2 left-1/2 top-0 w-px -translate-x-1/2 bg-line" />
                      <span class="absolute left-1/2 top-1/2 h-px w-1/2 bg-line" />
                      <span
                        v-if="row.hasNextSibling"
                        class="absolute bottom-0 left-1/2 top-1/2 w-px -translate-x-1/2 bg-line"
                      />
                    </span>

                    <!-- Тоггл — span, а не button: у Tab-порядку між
                         двома рядками інакше опинилося б стільки кнопок,
                         скільки рядків у вікні. Доступна афорданс —
                         aria-expanded на рядку плюс ← і →. -->
                    <span
                      v-if="row.hasChildren"
                      class="relative flex h-full w-5 shrink-0 items-center justify-center text-muted transition-colors hover:text-ink"
                      :class="CHEVRON_TOUCH"
                      aria-hidden="true"
                      @click.stop="toggle(row)"
                    >
                      <!-- Індикатор рівно на місці шеврона й того ж
                           розміру: він його ЗАМІНЮЄ, тож будь-який інший
                           розмір смикає рядок при кожному відкритті. -->
                      <svg
                        v-if="loadingSet.has(row.id)"
                        class="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          class="opacity-30"
                          cx="12"
                          cy="12"
                          r="9"
                          stroke="currentColor"
                          stroke-width="3"
                        />
                        <path
                          d="M21 12a9 9 0 0 0-9-9"
                          stroke="currentColor"
                          stroke-width="3"
                          stroke-linecap="round"
                        />
                      </svg>
                      <svg
                        v-else
                        class="h-3.5 w-3.5 transition-transform"
                        :class="row.expanded ? 'rotate-90' : ''"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M9 6l6 6-6 6"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                        />
                      </svg>
                    </span>
                    <!--
                      У листка шеврона немає, і горизонталь обривалась за
                      цілу колонку до вмісту. Продовжуємо її тут — але не
                      до самого краю: right-1.5 лишає зазор.

                      Зазор обов'язковий саме тому, що іконка — слот, а не
                      обов'язковий елемент. Коли її не передали, одразу за
                      цією колонкою починається текст, і лінія впиралася б
                      у першу літеру. З іконкою той самий зазор теж
                      доречний — у гілок він уже є, бо шеврон центрований
                      у своїй колонці.
                    -->
                    <span v-else class="relative h-full w-5 shrink-0" aria-hidden="true">
                      <span
                        v-if="row.depth > 0"
                        class="absolute left-0 right-1.5 top-1/2 h-px bg-line"
                      />
                    </span>

                    <span v-if="$slots.icon" class="mr-1.5 flex shrink-0 items-center text-muted">
                      <slot
                        name="icon"
                        :item="row.item"
                        :depth="row.depth"
                        :expanded="row.expanded"
                        :has-children="row.hasChildren"
                      />
                    </span>

                    <span class="min-w-0 flex-1 truncate text-ink">
                      <slot
                        name="label"
                        :item="row.item"
                        :depth="row.depth"
                        :expanded="row.expanded"
                        :has-children="row.hasChildren"
                      >
                        {{ displayValue(row.item, header.value) }}
                      </slot>
                    </span>
                  </div>

                  <div
                    v-else
                    class="flex items-center overflow-hidden"
                    :style="{ height: `${rowHeightPx}px` }"
                  >
                    <span class="min-w-0 flex-1 truncate">
                      <slot
                        :name="`cell-${header.value}`"
                        :item="row.item"
                        :header="header"
                        :depth="row.depth"
                      >
                        {{ displayValue(row.item, header.value) }}
                      </slot>
                    </span>
                  </div>
                </td>
              </tr>

              <tr
                v-if="range.bottomPad > 0"
                aria-hidden="true"
                :style="{ height: `${range.bottomPad}px` }"
              >
                <td :colspan="columnCount" class="p-0" />
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div
        v-if="canScrollLeft"
        class="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card to-transparent"
        :class="mobileCards ? 'hidden md:block' : ''"
        aria-hidden="true"
      />
      <div
        v-if="canScrollRight"
        class="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card to-transparent"
        :class="mobileCards ? 'hidden md:block' : ''"
        aria-hidden="true"
      />
    </div>

    <!--
      Мобільні картки. Розкладку обирає CSS, а не JS: обидва контейнери
      живуть у DOM, і прихований спорожнюється ВИМІРОМ — ResizeObserver
      віддає нульовий бокс під display:none. matchMedia тут неможливий:
      на сервері ширини вікна немає, і будь-яка гілка по брейкпойнту
      розійшлася б із прередереним HTML.
    -->
    <div
      v-if="mobileCards"
      ref="cardEl"
      role="tree"
      :aria-label="ariaLabel"
      class="scrollbar-thin overflow-y-auto md:hidden"
      :style="maxHeight === 'none' ? undefined : { maxHeight }"
      @scroll.passive="measureCards"
    >
      <p
        v-if="showEmpty"
        class="rounded-card border border-line px-4 py-10 text-center text-sm text-muted"
      >
        {{ emptyText }}
      </p>

      <div v-if="cardRange.topPad > 0" :style="{ height: `${cardRange.topPad}px` }" aria-hidden="true" />

      <div
        v-for="row in showEmpty ? [] : visibleCards"
        :key="`card-${row.id}`"
        role="treeitem"
        :aria-level="row.depth + 1"
        :aria-posinset="row.posinset"
        :aria-setsize="row.setsize"
        :aria-expanded="row.hasChildren ? row.expanded : undefined"
        :aria-selected="selectable ? rowSelection(row).checked : undefined"
        :aria-busy="loadingSet.has(row.id) || undefined"
        :style="{ height: `${cardHeight}px`, ...cardIndent(row.depth) }"
        class="pb-2"
      >
        <!--
          Проміжок між картками — паддінг УСЕРЕДИНІ фіксованої висоти, а
          не marginBottom на картці. Марджин додається до cardHeight, і
          крок списку перестає збігатися з числом, на яке вікно множить
          індекс: 88px картки плюс 7.5px марджину дають 95.5 замість 96,
          і на двохстах картках полотно коротшає на сотню пікселів.
        -->
        <div
          class="flex h-full items-start gap-2 overflow-hidden rounded-card border border-line bg-card pr-3 pt-2"
          :class="[
            rowSelection(row).checked ? 'border-accent-solid bg-primary-50' : '',
            rowClass?.(row.item),
          ]"
        >
        <div v-if="selectable" class="pt-0.5" @pointerdown="pendingShift = $event.shiftKey">
          <UiCheckbox
            :model-value="rowSelection(row).checked"
            :indeterminate="rowSelection(row).indeterminate"
            :disabled="!canSelectId(row.id)"
            class="w-5"
            @update:model-value="toggleRow(row, $event)"
          >
            <span class="sr-only">{{ rowSelectionLabel(row) }}</span>
          </UiCheckbox>
        </div>

        <span
          v-if="row.hasChildren"
          class="relative flex h-6 w-6 shrink-0 items-center justify-center text-muted"
          :class="CHEVRON_TOUCH"
          aria-hidden="true"
          @click.stop="toggle(row)"
        >
          <svg
            v-if="loadingSet.has(row.id)"
            class="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle class="opacity-30" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
          <svg
            v-else
            class="h-3.5 w-3.5 transition-transform"
            :class="row.expanded ? 'rotate-90' : ''"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </span>
        <span v-else class="w-6 shrink-0" aria-hidden="true" />

        <div class="min-w-0 flex-1 overflow-hidden" @click="onRowClick(row)">
          <slot name="mobile-card" :item="row.item" :depth="row.depth">
            <p class="truncate text-sm font-medium text-ink">
              <slot
                name="label"
                :item="row.item"
                :depth="row.depth"
                :expanded="row.expanded"
                :has-children="row.hasChildren"
              >
                {{ displayValue(row.item, treeColumnValue) }}
              </slot>
            </p>
            <dl class="mt-1 space-y-0.5">
              <div
                v-for="header in visibleHeaders.filter((h) => h.value !== treeColumnValue)"
                :key="header.value"
                class="flex justify-between gap-3 text-xs"
              >
                <dt class="shrink-0 text-muted">{{ header.text }}</dt>
                <dd class="min-w-0 truncate text-right text-ink">
                  <slot
                    :name="`cell-${header.value}`"
                    :item="row.item"
                    :header="header"
                    :depth="row.depth"
                  >
                    {{ displayValue(row.item, header.value) }}
                  </slot>
                </dd>
              </div>
            </dl>
          </slot>
          </div>
        </div>
      </div>

      <div
        v-if="cardRange.bottomPad > 0"
        :style="{ height: `${cardRange.bottomPad}px` }"
        aria-hidden="true"
      />
    </div>
  </div>
</template>
