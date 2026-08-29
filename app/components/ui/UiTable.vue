<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'
import UiCheckbox from './UiCheckbox.vue'
import UiMenu from './UiMenu.vue'
import UiSkeleton from './UiSkeleton.vue'
import {
  keysBetween,
  selectionState,
  subtractKeys,
  unionKeys,
  type SelectionKey,
} from '~/utils/tableSelection'

export interface TableHeader {
  /** Ключ поля в об'єкті рядка. Він же — суфікс іменованих слотів. */
  value: string
  text: string
  sortable?: boolean
  /**
   * Ширина в ПІКСЕЛЯХ (число, не рядок).
   *
   * Для `flex: true` трактується як МІНІМАЛЬНА: колонка починається з неї
   * і росте на залишок.
   *
   * Число, бо ширини живуть у `<colgroup>` і беруть участь в арифметиці
   * ресайзу, збереження і підрахунку переповнення. CSS-рядок цього не дає.
   */
  width?: number
  /**
   * Колонка забирає весь залишок ширини. Дозволена ОДНА на таблицю.
   * Сума фіксованих ширин має вміщатись у контейнер.
   */
  flex?: boolean
  align?: 'left' | 'center' | 'right'
  /** Перенос у комірці: 1 — обрізати, 2–6 — стільки рядків, false — без обмежень. */
  clamp?: 1 | 2 | 3 | 4 | 5 | 6 | false
  /** Повна назва: підказка на заголовку і підпис у меню налаштувань. */
  title?: string
  /** Напрям ПЕРШОГО кліку по сортуванню. Типово `asc`. */
  defaultSortDir?: 'asc' | 'desc'
  /** Колонку не можна приховати. */
  required?: boolean
  /** Заборонити ресайз. Типово можна все, крім `flex`. */
  resizable?: boolean
  visible?: boolean
}

export interface TableSort {
  by: string
  dir: 'asc' | 'desc'
}

const props = withDefaults(
  defineProps<{
    /** Опис колонок: ключ, підпис, вирівнювання, ширина, сортованість. */
    headers: TableHeader[]
    /** Рядки таблиці. Ключ рядка береться з поля, названого в `keyRow`. */
    items: T[]
    /** Поле-ідентифікатор рядка для `:key`. */
    keyRow?: string
    /** Поточне сортування. Використовуйте через `v-model:sort`. */
    sort?: TableSort | null
    /**
     * Сортувати на сервері: компонент лише повідомляє про намір через
     * `update:sort`, але порядок рядків не чіпає.
     */
    serverSort?: boolean
    /** Показує скелетони замість рядків, зберігаючи висоту таблиці. */
    loading?: boolean
    /** Скільки рядків-заглушок показати під час ПЕРШОГО завантаження. */
    skeletonRows?: number
    /** Текст, коли рядків немає. Складніший стан — слот `empty`. */
    emptyText?: string
    /**
     * Щільність рядків. `sm` для довгих таблиць, де важливіше бачити
     * більше рядків.
     */
    density?: 'sm' | 'md'
    /** Показати перемикач щільності в меню налаштувань. */
    densityToggle?: boolean
    /** Робить рядки клікабельними: додає роль, фокус і обробку Enter/Space. */
    rowClickable?: boolean
    /**
     * Клас на рядок — для підсвітки виділених, помилкових тощо.
     *
     * З `tableId` рядок отримує власне тло `bg-card` (його успадковує жолоб
     * налаштувань), тож заливка звідси має бути утилітою, яка в CSS іде
     * після `bg-card` — усі семантичні токени (`bg-warning-bg`,
     * `bg-danger-bg`, `bg-primary-50`) підходять.
     */
    rowClass?: (item: T) => string | undefined
    /**
     * Нижче `md` таблиця ховається, а замість неї рендериться список
     * карток — із ТИХ САМИХ слотів `cell-*`. Одне API, дві верстки.
     */
    mobileCards?: boolean
    /** Закріпити шапку. Вимагає `maxHeight`, інакше не діє. */
    stickyHeader?: boolean
    /** Напр. `"24rem"`. Без нього `stickyHeader` не має де закріплюватись. */
    maxHeight?: string
    /**
     * Вмикає меню налаштувань і збереження розкладки в localStorage під
     * ключем `table_settings_${tableId}`. Без нього таблиця некерована
     * користувачем і нічого не запам'ятовує.
     */
    tableId?: string
    /**
     * Версія ВАШИХ дефолтів. Змінили ширини чи видимість у `headers` —
     * підніміть число, і збережений вибір користувача скинеться.
     */
    settingsVersion?: number
    /**
     * Вмикає колонку прапорців ліворуч. Ключем виділення служить той самий
     * `keyRow`, що вже дає рядкам `:key`.
     */
    selectable?: boolean
    /** Ключі обраних рядків. Використовуйте через `v-model:selected`. */
    selected?: SelectionKey[]
    /**
     * Які рядки взагалі можна обрати. Незбиральний рядок показує вимкнений
     * прапорець і не потрапляє ні в «обрати всі», ні в діапазон Shift.
     */
    selectableRow?: (item: T) => boolean
    /**
     * Панель «Вибрано N» над таблицею. Вимикайте, коли масові дії живуть у
     * власному тулбарі споживача.
     */
    selectionBar?: boolean
  }>(),
  {
    keyRow: 'id',
    sort: null,
    skeletonRows: 5,
    emptyText: 'Даних немає',
    density: 'md',
    densityToggle: true,
    settingsVersion: 0,
    selected: () => [],
    selectionBar: true,
  },
)

const emit = defineEmits<{
  'update:sort': [value: TableSort | null]
  'update:headers': [value: TableHeader[]]
  'update:selected': [value: SelectionKey[]]
  rowClick: [item: T]
}>()

/*
 * defineSlots із generic="T" обов'язковий: для генеричних компонентів
 * vue-component-meta не читає слоти з шаблону (language-tools#3429), і
 * таблиця API лишилася б без секції «Слоти».
 */
defineSlots<{
  /** `cell-<value>` — власний рендер комірки. Приклад: `#cell-status`. */
  [key: `cell-${string}`]: (props: { item: T; header: TableHeader }) => unknown
  /** `header-<value>` — власний рендер заголовка колонки. */
  [key: `header-${string}`]: (props: { header: TableHeader }) => unknown
  /** Вміст картки нижче `md`, якщо стандартний список пар не підходить. */
  'mobile-card'?: (props: { item: T }) => unknown
  /** Показується замість «Даних немає». */
  empty?: () => unknown
  /** Дії в панелі «Вибрано N». `clear` знімає виділення. */
  'selection-actions'?: (props: {
    selected: SelectionKey[]
    items: T[]
    clear: () => void
  }) => unknown
}>()

const slots = useSlots()

/* ---------------------------------------------------------------- */
/*  Константи                                                       */
/* ---------------------------------------------------------------- */

/** Формат збереженого payload. Піднімає САМ компонент, не споживач. */
const SETTINGS_SCHEMA = 1
/** Ширина колонки прапорців. 44px — мінімальна ціль для пальця. */
const SELECTION_COLUMN_WIDTH = 44
const MIN_WIDTH = 40
const MAX_WIDTH = 800
const DEFAULT_WIDTH = 120

// Літерали, а не інтерполяція: інакше JIT Tailwind цих класів не побачить.
const CLAMP_CLASSES = {
  1: 'truncate',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
} as const

const ALIGN_TH = {
  left: 'text-left',
  center: 'text-center',
  // tabular-nums на числових колонках: без нього цифри різної ширини
  // змушують колонку «дихати» при кожному оновленні даних.
  right: 'text-right',
} as const

const DENSITY_CLASSES = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3 py-2.5 text-sm',
} as const

/* ---------------------------------------------------------------- */
/*  Стан колонок                                                    */
/* ---------------------------------------------------------------- */

interface StoredSettings {
  schema: number
  /** Версія дефолтів споживача — приходить із props.settingsVersion. */
  defaults: number
  density?: 'sm' | 'md'
  headers: { value: string; width?: number; visible?: boolean }[]
}

const localHeaders = ref<TableHeader[]>([])
const localDensity = ref<'sm' | 'md'>(props.density)

/*
 * Збережена розкладка застосовується ЛИШЕ після монтування.
 *
 * Сторінки прередеряться, і на сервері localStorage немає — там розкладка
 * завжди з props. Якби клієнт читав сховище вже в setup, ПЕРШИЙ його рендер
 * не збігся б із надісланим HTML: інша кількість <col>, інший порядок
 * заголовків. Vue лаявся б «Hydration completed but contains mismatches», а
 * DOM лишався б частково пропатченим — виміряно: колонка з ширинами сусідки
 * і жолоб налаштувань завширшки 220px.
 *
 * Ціна — короткий проблиск дефолтної розкладки до застосування збереженої.
 * Уникнути його на прередереній сторінці неможливо: сервер не знає, що
 * лежить у сховищі конкретного браузера.
 */
const isMounted = ref(false)

const visibleHeaders = computed(() => localHeaders.value.filter((h) => h.visible !== false))
const showSettings = computed(() => !!props.tableId)

function normalize(header: TableHeader, saved?: StoredSettings['headers'][number]): TableHeader {
  return {
    ...header,
    width: saved?.width ?? header.width ?? DEFAULT_WIDTH,
    visible: saved?.visible ?? header.visible !== false,
  }
}

function storageKey() {
  return `table_settings_${props.tableId}`
}

function loadSettings(): StoredSettings | null {
  if (!isMounted.value || typeof localStorage === 'undefined' || !props.tableId) return null
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredSettings>
    if (!Array.isArray(parsed.headers)) return null

    // Споживач змінив свої дефолти — збережене більше не описує ту саму
    // таблицю, і тримати його означало б показувати чужу розкладку.
    if ((parsed.defaults ?? 0) !== props.settingsVersion) return null

    // Старий формат payload. Порядок і видимість — вибір КОРИСТУВАЧА,
    // лишаємо; ширини й щільність належать компоненту, і саме вони
    // змінились — скидаємо до свіжих дефолтів.
    if (parsed.schema !== SETTINGS_SCHEMA) {
      return {
        schema: SETTINGS_SCHEMA,
        defaults: props.settingsVersion,
        headers: parsed.headers.map((h) => ({ value: h.value, visible: h.visible })),
      }
    }
    return parsed as StoredSettings
  } catch {
    return null
  }
}

function saveSettings() {
  if (typeof localStorage === 'undefined' || !props.tableId) return
  const payload: StoredSettings = {
    schema: SETTINGS_SCHEMA,
    defaults: props.settingsVersion,
    density: localDensity.value,
    headers: localHeaders.value.map((h) => ({
      value: h.value,
      width: h.width,
      visible: h.visible,
    })),
  }
  try {
    localStorage.setItem(storageKey(), JSON.stringify(payload))
  } catch {
    // Квота або приватний режим — не привід валити обробник кліку.
  }
}

function commitHeaders() {
  saveSettings()
  emit('update:headers', localHeaders.value)
}

/**
 * Зведення збереженої розкладки зі свіжими `headers`.
 *
 * Нова колонка вставляється ПІСЛЯ найближчого лівого сусіда, а не в
 * кінець. Інакше колонка, додана через пів року, стрибала б у хвіст у
 * кожного користувача, який колись міняв порядок.
 */
function reconcile(incoming: TableHeader[]) {
  const settings = loadSettings()
  if (!settings) {
    localHeaders.value = incoming.map((h) => normalize(h))
    if (settings === null && props.tableId) localDensity.value = props.density
    return
  }

  localDensity.value = settings.density ?? props.density

  const pool = new Map(incoming.map((h) => [h.value, h]))
  const ordered: TableHeader[] = []

  // Спершу — у збереженому порядку (перевпорядкування користувача живе).
  for (const saved of settings.headers) {
    const original = pool.get(saved.value)
    if (!original) continue
    ordered.push(normalize(original, saved))
    pool.delete(saved.value)
  }

  // Далі — нові колонки, кожна поруч зі своїм сусідом із props.
  for (const header of incoming) {
    if (!pool.has(header.value)) continue
    let insertAt = ordered.length
    const idx = incoming.findIndex((h) => h.value === header.value)
    for (let i = idx - 1; i >= 0; i--) {
      const prev = ordered.findIndex((h) => h.value === incoming[i]?.value)
      if (prev !== -1) {
        insertAt = prev + 1
        break
      }
    }
    ordered.splice(insertAt, 0, normalize(header))
    pool.delete(header.value)
  }

  localHeaders.value = ordered
}

// tableId у джерелах watch обов'язковий: його часто передають динамічно
// (`group-${id}`) при сталих headers — без цього наступна сутність
// відкривалася б із розкладкою попередньої.
watch(
  [() => props.headers, () => props.tableId, isMounted],
  ([incoming]) => reconcile(incoming as TableHeader[]),
  { immediate: true, deep: true },
)

/* ---------------------------------------------------------------- */
/*  Виділення рядків                                                */
/* ---------------------------------------------------------------- */

const selectedSet = computed(() => new Set<SelectionKey>(props.selected))

const keyOf = (item: T): SelectionKey => item[props.keyRow] as SelectionKey

function canSelect(item: T) {
  return props.selectableRow ? props.selectableRow(item) : true
}

/** Ключі рядків, які видно ЗАРАЗ, у порядку показу. */
const selectablePageKeys = computed(() => sortedItems.value.filter(canSelect).map(keyOf))

const headerSelection = computed(() => selectionState(selectablePageKeys.value, selectedSet.value))

const selectedCount = computed(() => props.selected.length)

const selectedItems = computed(() => props.items.filter((item) => selectedSet.value.has(keyOf(item))))

/*
 * «Обрати всі» — це ОБ'ЄДНАННЯ з поточним набором, а не заміна.
 *
 * UiTable не пагінує: `items` — це вже сторінка, а UiPagination живе окремо.
 * Якби прапорець у шапці ЗАМІНЯВ набір, користувач, який вибрав рядки,
 * перейшов на другу сторінку й натиснув «обрати всі», мовчки втратив би
 * вибір з першої.
 */
function toggleAll(next: boolean) {
  emit(
    'update:selected',
    next
      ? unionKeys(props.selected, selectablePageKeys.value)
      : subtractKeys(props.selected, selectablePageKeys.value),
  )
}

/*
 * Shift+клік бере якір від останнього перемикання БЕЗ Shift і ставить
 * усьому діапазону той стан, який отримав якір — як у Finder і Gmail.
 * Почергове перемикання кожного рядка діапазону дало б результат, який
 * неможливо передбачити оком.
 */
let selectionAnchor: SelectionKey | null = null

/*
 * UiCheckbox емітить `change: [value: boolean]` без об'єкта події, тож
 * shiftKey звідти не дістати. Ловимо його на комірці, поки натискання ще
 * не перетворилось на change.
 */
const pendingShift = ref(false)

function toggleRow(item: T, next: boolean) {
  const key = keyOf(item)
  if (!canSelect(item)) return

  if (pendingShift.value && selectionAnchor !== null) {
    const range = keysBetween(selectablePageKeys.value, selectionAnchor, key)
    emit('update:selected', next
      ? unionKeys(props.selected, range)
      : subtractKeys(props.selected, range))
  } else {
    selectionAnchor = key
    emit('update:selected', next
      ? unionKeys(props.selected, [key])
      : subtractKeys(props.selected, [key]))
  }
  pendingShift.value = false
}

function clearSelection() {
  selectionAnchor = null
  if (props.selected.length) emit('update:selected', [])
}

/**
 * Доступне ім'я прапорця рядка.
 *
 * Береться з першої видимої колонки, якщо там примітив; інакше лишається
 * ключ. Голе «Обрати рядок» у таблиці на сто рядків не розрізняє нічого.
 */
function rowSelectionLabel(item: T): string {
  const first = visibleHeaders.value[0]
  const value = first ? item[first.value] : undefined
  const readable = typeof value === 'string' || typeof value === 'number' ? String(value) : String(keyOf(item))
  return `Обрати рядок ${readable}`
}

defineExpose({
  /** Знімає виділення. Потрібне після успішної масової дії. */
  clearSelection,
  /** Обирає всі доступні рядки поточного `items`. */
  selectAllOnPage: () => toggleAll(true),
})

/* ---------------------------------------------------------------- */
/*  Геометрія                                                       */
/* ---------------------------------------------------------------- */

const densityClass = computed(() => DENSITY_CLASSES[localDensity.value])

/*
 * Ширина flex-колонки входить у мінімум, а не виключається з нього.
 *
 * За table-layout: fixed колонка без width отримує ЗАЛИШОК. Якщо мінімум
 * рахувати лише по фіксованих, він дорівнює їхній сумі — залишку не
 * лишається взагалі, і flex-колонка схлопується в нуль. Виміряно: у демо
 * каталогу «Назва» мала ширину 0px, поки її 220px не потрапили в суму.
 */
const tableMinWidth = computed(() => {
  const columns = visibleHeaders.value.reduce((sum, h) => sum + (h.width ?? DEFAULT_WIDTH), 0)
  return (
    columns +
    // Забути цей доданок — і table-layout: fixed відбере ширину в
    // flex-колонки рівно на 44px, обрізавши останню колонку.
    (props.selectable ? SELECTION_COLUMN_WIDTH : 0)
  )
})

function alignClass(header: TableHeader) {
  return ALIGN_TH[header.align ?? 'left']
}

function clampClass(header: TableHeader) {
  if (header.clamp === false) return ''
  return CLAMP_CLASSES[header.clamp ?? 1]
}

/**
 * Підказка ставиться лише для колонок БЕЗ слота і лише для примітивів.
 * Інакше вона показувала б `[object Object]` для об'єктних полів і сирий
 * код статусу замість підпису.
 */
function cellTitle(item: T, header: TableHeader): string | undefined {
  if (slots[`cell-${header.value}`]) return undefined
  const value = item[header.value]
  if (value == null || typeof value === 'object') return undefined
  return String(value) || undefined
}

function isResizable(header: TableHeader) {
  return showSettings.value && !header.flex && header.resizable !== false
}

/* ---------------------------------------------------------------- */
/*  Афорданси горизонтальної прокрутки                              */
/* ---------------------------------------------------------------- */

const scrollEl = ref<HTMLElement | null>(null)
const scrollLeft = ref(0)
const viewportWidth = ref(0)

/*
 * Переповнення рахуємо як `tableMinWidth − viewport`, а не через
 * scrollWidth. Так афорданс реагує і на зміну ширини КОЛОНКИ, від якої
 * розмір контейнера не міняється — самого ResizeObserver було б замало.
 */
function measure() {
  const el = scrollEl.value
  if (!el) return
  scrollLeft.value = el.scrollLeft
  viewportWidth.value = el.clientWidth
}

const canScrollLeft = computed(() => scrollLeft.value > 1)
const canScrollRight = computed(
  () => viewportWidth.value > 0 && tableMinWidth.value - viewportWidth.value - scrollLeft.value > 1,
)

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  // Вмикає читання сховища і перезапускає reconcile через watch вище.
  isMounted.value = true
  void nextTick(measure)
  // ResizeObserver ловить те, чого не ловить resize вікна: згортання
  // сайдбара міняє ширину контейнера без жодної події вікна.
  if (typeof ResizeObserver !== 'undefined' && scrollEl.value) {
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(scrollEl.value)
  }
  window.addEventListener('resize', measure, { passive: true })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measure)
})

watch([tableMinWidth, () => props.items], () => void nextTick(measure))

/* ---------------------------------------------------------------- */
/*  Ресайз колонок                                                  */
/* ---------------------------------------------------------------- */

const resizing = ref<{ value: string; startX: number; startWidth: number } | null>(null)

function clampWidth(width: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)))
}

function patchHeader(value: string, patch: Partial<TableHeader>) {
  const index = localHeaders.value.findIndex((h) => h.value === value)
  if (index === -1) return
  localHeaders.value[index] = { ...localHeaders.value[index]!, ...patch }
}

function onResizeStart(event: PointerEvent, header: TableHeader) {
  if (!isResizable(header)) return
  // Без цього pointerdown на хваті долетить до кнопки сортування в тому
  // самому <th>, і кожен ресайз перемикав би сортування.
  event.preventDefault()
  event.stopPropagation()
  try {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  } catch {
    // Захоплення — оптимізація, а не умова роботи: без нього жест теж
    // доїде, просто перестане ловити рух за межами хвата.
  }
  resizing.value = {
    value: header.value,
    startX: event.clientX,
    startWidth: header.width ?? DEFAULT_WIDTH,
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

function resetWidth(header: TableHeader) {
  const original = props.headers.find((h) => h.value === header.value)
  patchHeader(header.value, { width: original?.width ?? DEFAULT_WIDTH })
  commitHeaders()
}

/* ---------------------------------------------------------------- */
/*  Меню налаштувань                                                */
/* ---------------------------------------------------------------- */

function isLastVisible(header: TableHeader) {
  return visibleHeaders.value.length === 1 && visibleHeaders.value[0]?.value === header.value
}

function canHide(header: TableHeader) {
  // Приховати останню видиму колонку не можна: це давало colspan="0" і
  // таблицю без жодного шляху назад.
  return !header.required && !isLastVisible(header)
}

function toggleVisibility(header: TableHeader) {
  if (header.visible !== false && !canHide(header)) return
  patchHeader(header.value, { visible: header.visible === false })
  commitHeaders()
}

function setWidth(header: TableHeader, raw: string) {
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return
  patchHeader(header.value, { width: clampWidth(parsed) })
  commitHeaders()
}

function showAll() {
  localHeaders.value = localHeaders.value.map((h) => ({ ...h, visible: true }))
  commitHeaders()
}

function resetAll() {
  if (typeof localStorage !== 'undefined' && props.tableId) {
    try {
      localStorage.removeItem(storageKey())
    } catch {
      // див. saveSettings
    }
  }
  localDensity.value = props.density
  localHeaders.value = props.headers.map((h) => normalize(h))
  emit('update:headers', localHeaders.value)
}

function setDensity(next: 'sm' | 'md') {
  localDensity.value = next
  saveSettings()
}

/* Перевпорядкування рідним HTML5-drag, без vuedraggable. */
const dragIndex = ref<number | null>(null)

function onDragStart(index: number, event: DragEvent) {
  dragIndex.value = index
  // Firefox не почне перетягування без setData.
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDrop(index: number) {
  const from = dragIndex.value
  dragIndex.value = null
  if (from === null || from === index) return
  const next = [...localHeaders.value]
  const [moved] = next.splice(from, 1)
  if (!moved) return
  next.splice(index, 0, moved)
  localHeaders.value = next
  commitHeaders()
}

function moveHeader(index: number, step: -1 | 1) {
  const target = index + step
  if (target < 0 || target >= localHeaders.value.length) return
  const next = [...localHeaders.value]
  const [moved] = next.splice(index, 1)
  if (!moved) return
  next.splice(target, 0, moved)
  localHeaders.value = next
  commitHeaders()
}

/* ---------------------------------------------------------------- */
/*  Сортування                                                      */
/* ---------------------------------------------------------------- */

const internalSort = ref<TableSort | null>(props.sort)
watch(() => props.sort, (value) => (internalSort.value = value))

/**
 * Порівняння з урахуванням чисел і локалі.
 *
 * Наївні `<` і `>` ставлять «Розділ 10» перед «Розділ 9», а кирилицю
 * сортують за кодами символів. Порожні значення завжди в кінці, незалежно
 * від напрямку: рядок без даних не має витісняти заповнені з початку.
 */
function compareValues(a: unknown, b: unknown, direction: 1 | -1): number {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1

  if (typeof a === 'number' && typeof b === 'number') return direction * (a - b)
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return direction * (Number(a) - Number(b))
  }

  return direction * String(a).localeCompare(String(b), 'uk', {
    numeric: true,
    sensitivity: 'base',
  })
}

const sortedItems = computed(() => {
  const sort = internalSort.value
  if (!sort || props.serverSort) return props.items
  const direction = sort.dir === 'asc' ? 1 : -1
  // Копія: сортування на місці мутувало б масив, переданий ззовні.
  return [...props.items].sort((a, b) => compareValues(a[sort.by], b[sort.by], direction))
})

function toggleSort(header: TableHeader) {
  if (!header.sortable) return
  const current = internalSort.value
  let next: TableSort | null
  if (current?.by !== header.value) next = { by: header.value, dir: header.defaultSortDir ?? 'asc' }
  else if (current.dir === (header.defaultSortDir ?? 'asc'))
    next = { by: header.value, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  // Третій клік скидає сортування — інакше повернутися до вихідного
  // порядку можна лише перезавантаженням сторінки.
  else next = null

  internalSort.value = next
  emit('update:sort', next)
}

function ariaSort(header: TableHeader): 'ascending' | 'descending' | 'none' | undefined {
  if (!header.sortable) return undefined
  if (internalSort.value?.by !== header.value) return 'none'
  return internalSort.value.dir === 'asc' ? 'ascending' : 'descending'
}

/* ---------------------------------------------------------------- */
/*  Рядки                                                           */
/* ---------------------------------------------------------------- */

function onRowActivate(item: T) {
  if (props.rowClickable) emit('rowClick', item)
}

function onRowKeydown(event: KeyboardEvent, item: T) {
  if (!props.rowClickable) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  // Space без preventDefault прокручує сторінку замість активації рядка.
  event.preventDefault()
  emit('rowClick', item)
}

const showSkeleton = computed(() => props.loading && props.items.length === 0)
const showEmpty = computed(() => !props.loading && sortedItems.value.length === 0)
</script>

<template>
  <div :class="{ 'select-none': !!resizing || selectable }">
    <!--
      Панель ЗОВНІ контейнера з overflow-auto: усередині нього вона з'їхала б
      горизонтально разом із таблицею і зникла б з очей рівно тоді, коли
      користувач прокрутив до колонки, заради якої й виділяв рядки.
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
          <slot name="selection-actions" :selected="props.selected" :items="selectedItems" :clear="clearSelection" />
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

    <div class="relative">
      <!--
        bg-card на контейнері обов'язковий, а не косметика: компонент і сам
        малює card у трьох місцях — жолоб налаштувань, градієнт прокрутки і
        оверлей «Оновлення…». Без власної поверхні вони лягають на те, що
        просвічує крізь прозорі рядки (типово bg-main), і жолоб стає світлою
        смугою вздовж останньої колонки. Виміряно: рядки #101216, жолоб
        #181b20 у темній темі.
      -->
      <div
        ref="scrollEl"
        class="scrollbar-thin relative overflow-auto rounded-card border border-line bg-card"
        :class="mobileCards ? 'hidden md:block' : ''"
        :style="maxHeight ? { maxHeight } : undefined"
        @scroll.passive="measure"
      >
        <table class="w-full border-collapse" :style="{ tableLayout: 'fixed', minWidth: `${tableMinWidth}px` }">
          <!--
            Ширини живуть ТУТ, а не на кожній комірці. За table-layout: fixed
            враховується лише перший рядок, тож інлайновий width на кожному
            <td> був би мертвим стилем, помноженим на кількість рядків.
            Колонка без width (flex) забирає залишок — це весь механізм, без JS.
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
            <tr class="border-b border-line bg-subtle">
              <th
                v-if="selectable"
                scope="col"
                class="w-11 px-2"
                :class="[densityClass, stickyHeader && maxHeight ? 'sticky top-0 z-10 bg-subtle' : '']"
              >
                <UiCheckbox
                  :model-value="headerSelection === 'all'"
                  :indeterminate="headerSelection === 'some'"
                  :disabled="!selectablePageKeys.length"
                  class="w-5"
                  @update:model-value="toggleAll($event)"
                >
                  <span class="sr-only">Обрати всі рядки на сторінці</span>
                </UiCheckbox>
              </th>
              <th
                v-for="header in visibleHeaders"
                :key="header.value"
                scope="col"
                :aria-sort="ariaSort(header)"
                :title="header.title"
                class="relative font-medium text-muted"
                :class="[
                  densityClass,
                  alignClass(header),
                  stickyHeader && maxHeight ? 'sticky top-0 z-10 bg-subtle' : '',
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
                    <!-- Привид-шеврон: підказка, що колонка взагалі сортується. -->
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

                <!-- Хват ресайзу. touch-none обов'язковий: без нього браузер
                     забирає горизонтальний жест собі як прокрутку. -->
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
              елементі у Vue 3 v-if має вищий пріоритет і не бачить змінної
              циклу.
            -->
            <template v-if="showSkeleton">
              <tr
                v-for="row in skeletonRows"
                :key="`sk-${row}`"
                class="border-b border-line last:border-0"
                :class="showSettings ? 'bg-card' : ''"
              >
                <td v-if="selectable" :class="densityClass" class="px-2">
                  <UiSkeleton class="h-4 w-4 rounded" />
                </td>
                <td v-for="header in visibleHeaders" :key="header.value" :class="densityClass">
                  <!-- Ширина заглушки детермінована, а не Math.random(): інакше
                       вона мінялася б на кожному рендері й миготіла. -->
                  <UiSkeleton
                    class="h-3"
                    :style="{ width: `${55 + ((row * 17 + header.value.length * 13) % 40)}%` }"
                  />
                </td>
              </tr>
            </template>

            <tr v-else-if="showEmpty">
              <td
                :colspan="visibleHeaders.length + (showSettings ? 1 : 0) + (selectable ? 1 : 0)"
                class="p-0"
              >
                <slot name="empty">
                  <p class="px-4 py-10 text-center text-sm text-muted">{{ emptyText }}</p>
                </slot>
              </td>
            </tr>

            <template v-else>
              <tr
                v-for="item in sortedItems"
                :key="String(item[keyRow])"
                class="border-b border-line transition-colors last:border-0"
                :class="[
                  showSettings ? 'bg-card' : '',
                  rowClickable
                    ? 'cursor-pointer hover:bg-hover focus:outline-none focus-visible:bg-hover focus-visible:ring-2 focus-visible:ring-ring'
                    : '',
                  selectable && selectedSet.has(item[keyRow] as string | number) ? 'bg-primary-50' : '',
                  rowClass?.(item),
                ]"
                :role="rowClickable ? 'button' : undefined"
                :tabindex="rowClickable ? 0 : undefined"
                :aria-selected="selectable ? selectedSet.has(item[keyRow] as string | number) : undefined"
                @click="onRowActivate(item)"
                @keydown="onRowKeydown($event, item)"
              >
                <!--
                  @click.stop обов'язковий: без нього перемикання прапорця
                  ще й «активує» рядок, і rowClickable-таблиця відкриває
                  картку щоразу, коли її намагаються лише виділити.
                -->
                <td
                  v-if="selectable"
                  class="px-2"
                  :class="densityClass"
                  @click.stop
                  @keydown.stop
                  @pointerdown="pendingShift = $event.shiftKey"
                >
                  <UiCheckbox
                    :model-value="selectedSet.has(item[keyRow] as string | number)"
                    :disabled="!canSelect(item)"
                    class="w-5"
                    @update:model-value="toggleRow(item, $event)"
                  >
                    <span class="sr-only">{{ rowSelectionLabel(item) }}</span>
                  </UiCheckbox>
                </td>
                <td
                  v-for="header in visibleHeaders"
                  :key="header.value"
                  :title="cellTitle(item, header)"
                  class="text-ink"
                  :class="[
                    densityClass,
                    alignClass(header),
                    header.align === 'right' ? 'tabular-nums' : '',
                  ]"
                >
                  <div :class="clampClass(header)">
                    <slot :name="`cell-${header.value}`" :item="item" :header="header">
                      {{ item[header.value] ?? '—' }}
                    </slot>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>


        <!-- Оверлей оновлення: дані вже є, але йде повторний запит. Заміняти
             їх скелетоном було б гірше — таблиця блимала б на кожному фільтрі. -->
        <div
          v-if="loading && items.length > 0"
          class="absolute inset-0 flex items-start justify-center bg-card/60 pt-10"
          aria-hidden="true"
        >
          <span class="text-sm text-muted">Оновлення…</span>
        </div>
      </div>

      <!-- Афорданси прокрутки: без них не видно, що праворуч є ще колонки. -->
      <div
        v-if="canScrollLeft"
        class="pointer-events-none absolute inset-y-0 left-0 w-6 rounded-l-card bg-gradient-to-r from-card to-transparent"
        :class="mobileCards ? 'hidden md:block' : ''"
        aria-hidden="true"
      />
      <div
        v-if="canScrollRight"
        class="pointer-events-none absolute inset-y-0 w-6 bg-gradient-to-l from-card to-transparent"
        :class="[mobileCards ? 'hidden md:block' : '', showSettings ? 'right-10' : 'right-0']"
        aria-hidden="true"
      />

      <!--
        Кнопка налаштувань — оверлей на зовнішньому контейнері, а не колонка.

        Колонка під неї (40px порожніх <td> у кожному рядку) створювала мертву
        смугу вздовж таблиці, крала ширину в останню колонку і розганяла
        горизонтальний скрол навіть там, де вміст вміщувався. Липкий жолоб
        right-0 при цьому ЗАВЖДИ накривав останні 40px вмісту — останню
        колонку не можна було прочитати навіть повністю прогорнувши.

        Зовнішній div.relative НЕ прокручується, тож absolute тут лишається
        на місці і при горизонтальному, і при вертикальному гортанні.
        right-[41px] — це 8px скролбара + ~33px видимої частини кнопки: вона
        не перекриває текст останньої колонки, лише злегка торкається її
        краю. z-30 — над липкою шапкою (z-10).
      -->
      <div
        v-if="showSettings"
        class="absolute right-[41px] top-0 z-30 flex items-center"
        :class="localDensity === 'sm' ? 'h-8' : 'h-11'"
      >
        <UiMenu
          width="20rem"
          placement="bottom-end"
          panel-role="dialog"
          aria-label="Налаштування колонок"
        >
          <template #trigger="{ toggle, triggerAttrs }">
            <button
              v-bind="triggerAttrs"
              type="button"
              class="flex items-center justify-center rounded-control bg-subtle text-muted shadow-card transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :class="localDensity === 'sm' ? 'h-7 w-7' : 'h-9 w-9'"
              aria-label="Налаштування колонок"
              @click="toggle"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 6h16M4 12h16M4 18h16M8 6v0M16 12v0M10 18v0"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <circle cx="8" cy="6" r="2" fill="currentColor" />
                <circle cx="16" cy="12" r="2" fill="currentColor" />
                <circle cx="10" cy="18" r="2" fill="currentColor" />
              </svg>
            </button>
          </template>

          <template #content>
            <div v-if="densityToggle" class="border-b border-line px-3 py-2">
              <p class="mb-1.5 text-xs font-medium text-muted">Щільність</p>
              <div class="flex gap-1">
                <button
                  v-for="option in (['sm', 'md'] as const)"
                  :key="option"
                  type="button"
                  class="flex-1 rounded-control border px-2 py-1.5 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  :class="
                    localDensity === option
                      ? 'border-primary-200 bg-primary-50 text-accent'
                      : 'border-line text-muted hover:bg-hover'
                  "
                  @click="setDensity(option)"
                >
                  {{ option === 'sm' ? 'Щільно' : 'Звичайно' }}
                </button>
              </div>
            </div>

            <div class="max-h-72 overflow-y-auto scrollbar-thin py-1">
              <div
                v-for="(header, index) in localHeaders"
                :key="header.value"
                class="flex items-center gap-2 px-2 py-1.5 hover:bg-hover"
                draggable="true"
                @dragstart="onDragStart(index, $event)"
                @dragover.prevent
                @drop.prevent="onDrop(index)"
              >
                <span class="cursor-grab text-muted active:cursor-grabbing" aria-hidden="true">
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                  </svg>
                </span>

                <label class="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    class="shrink-0 accent-[var(--accent-solid)]"
                    :checked="header.visible !== false"
                    :disabled="header.visible !== false && !canHide(header)"
                    @change="toggleVisibility(header)"
                  />
                  <span class="truncate">{{ header.title || header.text || header.value }}</span>
                </label>

                <div class="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                    :disabled="index === 0"
                    :aria-label="`Перемістити «${header.title || header.text || header.value}» вище`"
                    @click="moveHeader(index, -1)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                    :disabled="index === localHeaders.length - 1"
                    :aria-label="`Перемістити «${header.title || header.text || header.value}» нижче`"
                    @click="moveHeader(index, 1)"
                  >
                    ↓
                  </button>
                </div>

                <input
                  v-if="!header.flex"
                  type="number"
                  class="w-16 shrink-0 rounded border border-line bg-input px-1.5 py-1 text-right text-xs text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  :value="header.width"
                  :min="40"
                  :max="800"
                  aria-label="Ширина колонки, px"
                  @change="setWidth(header, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>

            <div class="flex gap-1 border-t border-line px-2 py-2">
              <button
                type="button"
                class="flex-1 rounded-control px-2 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                @click="showAll"
              >
                Показати всі
              </button>
              <button
                type="button"
                class="flex-1 rounded-control px-2 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                @click="resetAll"
              >
                Скинути
              </button>
            </div>
          </template>
        </UiMenu>
      </div>
    </div>

    <!-- Мобільні картки з ТИХ САМИХ слотів cell-* -->
    <div v-if="mobileCards" class="space-y-2 md:hidden">
      <p v-if="showEmpty" class="rounded-card border border-line px-4 py-10 text-center text-sm text-muted">
        {{ emptyText }}
      </p>
      <div
        v-for="item in showEmpty ? [] : sortedItems"
        :key="`m-${String(item[keyRow])}`"
        class="flex items-start gap-3 rounded-card border border-line bg-card p-3"
        :class="[
          selectable && selectedSet.has(item[keyRow] as string | number) ? 'border-accent-solid bg-primary-50' : '',
          rowClass?.(item),
        ]"
      >
        <!--
          Прапорець стоїть ЗОВНІ елемента з role="button", а не всередині
          нього: інтерактивний контрол усередині ролі кнопки недосяжний для
          скрінрідера в режимі читання.
        -->
        <div v-if="selectable" class="pt-0.5" @pointerdown="pendingShift = $event.shiftKey">
          <UiCheckbox
            :model-value="selectedSet.has(item[keyRow] as string | number)"
            :disabled="!canSelect(item)"
            class="w-5"
            @update:model-value="toggleRow(item, $event)"
          >
            <span class="sr-only">{{ rowSelectionLabel(item) }}</span>
          </UiCheckbox>
        </div>

        <div
          class="min-w-0 flex-1"
          :class="rowClickable ? 'cursor-pointer' : ''"
          :role="rowClickable ? 'button' : undefined"
          :tabindex="rowClickable ? 0 : undefined"
          @click="onRowActivate(item)"
          @keydown="onRowKeydown($event, item)"
        >
        <slot name="mobile-card" :item="item">
          <dl class="space-y-1.5">
            <div
              v-for="header in visibleHeaders"
              :key="header.value"
              class="flex justify-between gap-3 text-sm"
            >
              <dt class="shrink-0 text-muted">{{ header.text }}</dt>
              <dd class="min-w-0 text-right text-ink">
                <slot :name="`cell-${header.value}`" :item="item" :header="header">
                  {{ item[header.value] ?? '—' }}
                </slot>
              </dd>
            </div>
          </dl>
        </slot>
        </div>
      </div>
    </div>
  </div>
</template>
