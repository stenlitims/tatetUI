<!--
  `Record<string, any>`, а не `Record<string, unknown>`: під `unknown`
  жоден `interface` рядка не проходив обмеження («Index signature for type
  'string' is missing») — типи з API-клієнтів доводилося переписувати на
  `interface X extends Record<string, unknown>`. Під `any` interface
  сумісний, а доступ `item[key]` лишається без приведень.
-->
<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, useSlots, watch } from 'vue'
import UiCheckbox from './UiCheckbox.vue'
import UiSkeleton from './UiSkeleton.vue'
import TableColumnSettings from './table/ColumnSettings.vue'
import {
  keysBetween,
  selectionState,
  subtractKeys,
  unionKeys,
  type SelectionKey,
} from '~/utils/tableSelection'
/*
 * Ширини, порівняння значень і зведення збереженої розкладки — спільні з
 * UiTreeTable. Дві копії тієї самої арифметики розходяться мовчки: у
 * дереві «Розділ 10» уже стояв після «Розділ 9», а тут — ще перед ним.
 */
import {
  clampWidth,
  columnsMinWidth,
  compareValues,
  mergeColumnSettings,
  COLUMN_DEFAULT_WIDTH,
  type StoredColumn,
} from '~/utils/tableColumns'

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
  /**
   * Значення, за яким сортувати рядок, замість `item[value]`. Потрібне,
   * коли в комірці не те, що порівнюється: вкладене поле
   * (`item.author.name`), код статусу з власним порядком, рядкова дата
   * «24.09.2026», яку рядкове порівняння ставить за днем, а не роком.
   * Серверне сортування (`serverSort`) його не викликає.
   */
  sortValue?: (item: Record<string, any>) => unknown
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
     * З `tableId` рядок отримує власне тло `bg-card`, тож заливка звідси
     * має бути утилітою, яка в CSS іде після `bg-card` — усі семантичні
     * токени (`bg-warning-bg`, `bg-danger-bg`, `bg-primary-50`) підходять.
     */
    rowClass?: (item: T) => string | undefined
    /**
     * Нижче `md` таблиця ховається, а замість неї рендериться список
     * карток — із ТИХ САМИХ слотів `cell-*`. Одне API, дві верстки.
     */
    mobileCards?: boolean
    /** Закріпити шапку. Вимагає `maxHeight` або `fill`, інакше не діє. */
    stickyHeader?: boolean
    /**
     * Закріпити ПЕРШУ видиму колонку при горизонтальній прокрутці — той
     * самий контракт, що `stickyTreeColumn` у `UiTreeTable`. Має сенс
     * лише коли перша колонка ідентифікує рядок (назва, номер).
     */
    stickyColumn?: boolean
    /** Напр. `"24rem"`. Без нього `stickyHeader` не має де закріплюватись. */
    maxHeight?: string
    /**
     * Висоту задає БАТЬКО, а не число тут. Контейнер прокрутки обіймає
     * вміст, поки той вміщається, і стискається до залишку висоти, щойно
     * перестав, — тож пагінація під таблицею лишається на екрані замість
     * їхати за нижню межу вікна, а під короткою таблицею не висить
     * порожня смуга на третину екрана.
     *
     * Вимагає ланцюжка flex-колонок із ВИЗНАЧЕНОЮ висотою (`h-dvh`,
     * `h-full`) і `min-h-0` на кожній ланці. Без такого ланцюжка стискати
     * немає до чого, і таблиця рендериться на всю свою висоту — саме тому
     * `fill` безпечний і на сторінці, що прокручується: там він просто
     * знімає кліть `maxHeight` і нічого не ламає.
     *
     * Перекриває `maxHeight`.
     */
    fill?: boolean
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

/*
 * Роздільник рядків — псевдоелемент, а не border, і таблиця —
 * border-separate. Те саме рішення, що в UiTreeTable, і з тієї ж причини,
 * що там: злиті межі (border-collapse) не малюються під закріпленою
 * шапкою — вона отримує власний контекст малювання, і лінія під нею
 * зникає рівно на час прокрутки. Псевдоелемент належить комірці, тож
 * їде разом із нею.
 */
const ROW_SEPARATOR =
  "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-line after:content-['']"

/*
 * Фокус клікабельного рядка малюється на КОМІРКАХ. ring на самому <tr> не
 * було видно ніколи: комірки позиційовані (`relative` під роздільник і
 * sticky), тож малюються поверх тіні рядка разом зі своїм непрозорим
 * тлом. Виміряно в Chromium: сфокусований рядок відрізнявся від сусідів
 * лише тлом наведення, 1.1:1. Перша й остання комірки додають бічні
 * краї; одна комірка на рядок отримує рамку цілком (дві псевдокласи —
 * вища специфічність, тож порядок у CSS не вирішує).
 */
const ROW_FOCUS_RING =
  '[&:focus-visible>td]:shadow-[inset_0_2px_0_var(--ring),inset_0_-2px_0_var(--ring)] ' +
  '[&:focus-visible>td:first-child]:shadow-[inset_2px_2px_0_var(--ring),inset_0_-2px_0_var(--ring)] ' +
  '[&:focus-visible>td:last-child]:shadow-[inset_-2px_2px_0_var(--ring),inset_0_-2px_0_var(--ring)] ' +
  '[&:focus-visible>td:first-child:last-child]:shadow-[inset_0_0_0_2px_var(--ring)]'

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

/*
 * Колонка прапорців має власний горизонтальний паддінг (вона вузька), але
 * ВЕРТИКАЛЬНИЙ мусить збігатися з рештою комірок — інакше прапорець
 * стоїть вище за текст рядка. Окремий набір, а не `px-2` поверх
 * `DENSITY_CLASSES`: два класи одного простору (px-2 і px-3) вирішувались
 * би порядком у згенерованому CSS, тобто випадково.
 */
const DENSITY_SELECTION = {
  sm: 'px-2 py-1.5',
  md: 'px-2 py-2.5',
} as const

/* ---------------------------------------------------------------- */
/*  Стан колонок                                                    */
/* ---------------------------------------------------------------- */

interface StoredSettings {
  schema: number
  /** Версія дефолтів споживача — приходить із props.settingsVersion. */
  defaults: number
  density?: 'sm' | 'md'
  headers: StoredColumn[]
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
 * і кнопка налаштувань не на своєму місці.
 *
 * Ціна — короткий проблиск дефолтної розкладки до застосування збереженої.
 * Уникнути його на прередереній сторінці неможливо: сервер не знає, що
 * лежить у сховищі конкретного браузера.
 */
const isMounted = ref(false)

const visibleHeaders = computed(() => localHeaders.value.filter((h) => h.visible !== false))
const showSettings = computed(() => !!props.tableId)
const columnCount = computed(() => visibleHeaders.value.length + (props.selectable ? 1 : 0))

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
 * Зведення збереженої розкладки зі свіжими `headers` — те саме
 * `mergeColumnSettings`, що в `UiTreeTable`, лише без закріпленої
 * колонки. Нова колонка стає ПІСЛЯ найближчого лівого сусіда, а не в
 * хвіст: інакше колонка, додана через пів року, стрибала б у кінець у
 * кожного, хто колись міняв порядок.
 */
function reconcile(incoming: TableHeader[]) {
  const settings = loadSettings()
  localDensity.value = settings?.density ?? props.density
  localHeaders.value = mergeColumnSettings(incoming, settings?.headers ?? null)
}

/*
 * tableId у джерелах watch обов'язковий: його часто передають динамічно
 * (`group-${id}`) при сталих headers — без цього наступна сутність
 * відкривалася б із розкладкою попередньої. props.density — теж:
 * споживач міняє щільність згори, а без неї reconcile перечитував би її
 * лише разом зі зміною колонок.
 */
watch(
  [() => props.headers, () => props.tableId, () => props.density, isMounted],
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
const densitySelectionClass = computed(() => DENSITY_SELECTION[localDensity.value])

/*
 * Шапка кріпиться лише всередині контейнера з ВЛАСНОЮ прокруткою, а таким
 * його роблять дві різні речі — `maxHeight` і `fill`. Умова мусить знати
 * про обидві: інакше перехід з одного на інший мовчки віддирає шапку, і
 * це виглядає як баг CSS, хоча це умова в шаблоні.
 */
const canStickHeader = computed(() => props.stickyHeader && (props.fill || !!props.maxHeight))

/*
 * Ширина flex-колонки входить у мінімум, а не виключається з нього.
 *
 * За table-layout: fixed колонка без width отримує ЗАЛИШОК. Якщо мінімум
 * рахувати лише по фіксованих, він дорівнює їхній сумі — залишку не
 * лишається взагалі, і flex-колонка схлопується в нуль. Виміряно: у демо
 * каталогу «Назва» мала ширину 0px, поки її 220px не потрапили в суму.
 */
const tableMinWidth = computed(() =>
  // Другий доданок — колонка прапорців. Забути його, і table-layout:
  // fixed відбере ширину в flex-колонки рівно на 44px, обрізавши останню.
  columnsMinWidth(visibleHeaders.value, props.selectable ? SELECTION_COLUMN_WIDTH : 0),
)

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

/*
 * Закріплена перша колонка стоїть ДРУГОЮ, коли є прапорці, тож left: 0
 * накривав би їх при першій же прокрутці. Прапорці кріпимо на нуль, а
 * колонку — одразу за ними. Той самий розрахунок, що в UiTreeTable.
 */
const stickyColumnStyle = computed(() =>
  props.stickyColumn ? { left: `${props.selectable ? SELECTION_COLUMN_WIDTH : 0}px` } : undefined,
)
const isStickyColumn = (header: TableHeader) =>
  props.stickyColumn && header.value === visibleHeaders.value[0]?.value

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

function resetWidth(header: TableHeader) {
  const original = props.headers.find((h) => h.value === header.value)
  patchHeader(header.value, { width: original?.width ?? COLUMN_DEFAULT_WIDTH })
  commitHeaders()
}

/* ---------------------------------------------------------------- */
/*  Меню налаштувань                                                */
/* ---------------------------------------------------------------- */

/*
 * Панель налаштувань — спільний компонент із UiTreeTable, тож видимість,
 * порядок і ширини редагуються там, а таблиця лише приймає результат і
 * зберігає його.
 */
function onSettingsHeaders(next: TableHeader[]) {
  localHeaders.value = next
  commitHeaders()
}

function onSettingsDensity(next: 'sm' | 'md') {
  localDensity.value = next
  saveSettings()
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
  localHeaders.value = mergeColumnSettings(props.headers, null)
  emit('update:headers', localHeaders.value)
}

/* ---------------------------------------------------------------- */
/*  Сортування                                                      */
/* ---------------------------------------------------------------- */

const internalSort = ref<TableSort | null>(props.sort)
watch(() => props.sort, (value) => (internalSort.value = value))

const sortedItems = computed(() => {
  const sort = internalSort.value
  if (!sort || props.serverSort) return props.items
  const direction = sort.dir === 'asc' ? 1 : -1
  // sortValue — з props.headers, а не з localHeaders: функція живе у
  // споживача, а локальна копія колонок — це лише розкладка.
  const read = props.headers.find((header) => header.value === sort.by)?.sortValue
    ?? ((item: T) => item[sort.by])
  // Значення читаються ОДИН раз на рядок, а не на кожне порівняння:
  // sortValue споживача може бути недешевим, а sort викликає компаратор
  // n·log n разів. Копія — бо сортування на місці мутувало б масив ззовні.
  return props.items
    .map((item) => ({ item, key: read(item) }))
    .sort((a, b) => compareValues(a.key, b.key, direction))
    .map((entry) => entry.item)
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

/*
 * Сортування на мобільних картках. Шапка таблиці там схована разом із
 * таблицею, тож без окремого контролу телефон просто втрачав сортування:
 * порядок лишався тим, який встиг обрати десктоп. Нативний <select> —
 * свідомо: на телефоні він відкриває системний вибір (колесо на iOS,
 * аркуш на Android), зручніший за будь-яку власну випадайку.
 */
const mobileSortId = `${useId()}-mobile-sort`
const mobileSortHeaders = computed(() =>
  props.mobileCards ? visibleHeaders.value.filter((header) => header.sortable) : [],
)

function onMobileSortBy(event: Event) {
  const by = (event.target as HTMLSelectElement).value
  const header = mobileSortHeaders.value.find((item) => item.value === by)
  const next: TableSort | null = header ? { by, dir: header.defaultSortDir ?? 'asc' } : null
  internalSort.value = next
  emit('update:sort', next)
}

function flipMobileSortDir() {
  const current = internalSort.value
  if (!current) return
  const next: TableSort = { by: current.by, dir: current.dir === 'asc' ? 'desc' : 'asc' }
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

/*
 * Контрол усередині рядка має власну дію. Без цієї перевірки кнопка
 * «Видалити» чи посилання в `cell-*` спершу «відкривали» рядок, а з
 * клавіатури не працювали зовсім: Enter спливав до рядка, і його
 * preventDefault скасовував активацію самої кнопки.
 */
const NESTED_CONTROL =
  'a[href],button,input,select,textarea,label,summary,[role="button"],[role="link"],[role="checkbox"],[role="switch"],[tabindex]:not([tabindex="-1"])'

function fromNestedControl(event: Event): boolean {
  const target = event.target as Element | null
  const row = event.currentTarget as Element | null
  if (!target || !row || target === row) return false
  const control = target.closest(NESTED_CONTROL)
  return !!control && control !== row && row.contains(control)
}

/*
 * Виділений мишею текст — це копіювання, а не клік. Відколи вибір рядків
 * більше не вимикає виділення тексту, інакше спроба скопіювати номер
 * замовлення з клікабельного рядка відкривала б його картку.
 */
function selectingTextIn(row: Element | null): boolean {
  if (!row || typeof window === 'undefined') return false
  const selection = window.getSelection?.()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false
  return row.contains(selection.anchorNode) || row.contains(selection.focusNode)
}

function onRowActivate(event: MouseEvent, item: T) {
  if (!props.rowClickable || fromNestedControl(event)) return
  if (selectingTextIn(event.currentTarget as Element | null)) return
  emit('rowClick', item)
}

function onRowKeydown(event: KeyboardEvent, item: T) {
  if (!props.rowClickable) return
  // Лише клавіші, натиснуті НА самому рядку: Enter на вкладеній кнопці
  // належить їй.
  if (event.target !== event.currentTarget) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  // Space без preventDefault прокручує сторінку замість активації рядка.
  event.preventDefault()
  emit('rowClick', item)
}

/*
 * Shift+клік по прапорцю розширює і виділення ТЕКСТУ від попереднього
 * кліку — через пів таблиці. Раніше від цього рятував select-none на
 * всьому компоненті, і в таблиці з вибором не можна було скопіювати
 * жодного значення. Тепер виділення гаситься лише на цьому жесті:
 * preventDefault на mousedown не скасовує ні click, ні зміну прапорця.
 */
function onSelectionMousedown(event: MouseEvent) {
  if (event.shiftKey) event.preventDefault()
}

const showSkeleton = computed(() => props.loading && props.items.length === 0)
const showEmpty = computed(() => !props.loading && sortedItems.value.length === 0)
</script>

<template>
  <!--
    У режимі `fill` каркас навмисно БЕЗ `flex-1`: колонка з `min-h-0`
    обіймає вміст і стискається лише коли не вміщається. З `flex-1`
    таблиця на три рядки розтягувалась би на весь екран порожнім тлом.
  -->
  <!--
    select-none — лише на час ресайзу. Раніше він стояв і на всій таблиці з
    `selectable`, і з неї не можна було скопіювати жодного значення; від
    виділення тексту Shift+кліком тепер береже onSelectionMousedown.
  -->
  <div :class="[{ 'select-none': !!resizing }, fill ? 'flex min-h-0 flex-col' : '']">
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

    <!--
      Тулбар налаштувань — рядок над таблицею, а не липка колонка.

      Колонка під кнопкою (40px порожніх <td> у кожному рядку) створювала
      мертву смугу вздовж таблиці, крала ширину в останню колонку і
      розганяла горизонтальний скрол навіть там, де вміст вміщувався.
      Липкий жолоб right-0 при цьому ЗАВЖДИ накривав останні 40px вмісту —
      останню колонку не можна було прочитати навіть повністю прогорнувши.

      Тулбар не залежить ані від щільності рядків, ані від скролбарів.
      На мобільних картках колонок немає, але налаштування лишаються
      доцільними: видимість та порядок керують полями у картках.
    -->
    <div
      v-if="showSettings || mobileSortHeaders.length"
      class="mb-2 flex items-center gap-2"
      :class="showSettings ? '' : 'md:hidden'"
    >
      <div v-if="mobileSortHeaders.length" class="flex min-w-0 flex-1 items-center gap-2 md:hidden">
        <label :for="mobileSortId" class="shrink-0 text-sm text-muted">Сортувати</label>
        <select
          :id="mobileSortId"
          :value="internalSort?.by ?? ''"
          class="h-12 min-w-0 flex-1 cursor-pointer rounded-control border border-line bg-input pl-2.5 pr-7 text-[16px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @change="onMobileSortBy"
        >
          <option value="">Як є</option>
          <option v-for="header in mobileSortHeaders" :key="header.value" :value="header.value">
            {{ header.text }}
          </option>
        </select>
        <button
          type="button"
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-control border border-line bg-input text-muted transition-colors hover:text-ink active:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!internalSort"
          :aria-label="internalSort?.dir === 'desc' ? 'За спаданням — змінити на зростання' : 'За зростанням — змінити на спадання'"
          @click="flipMobileSortDir"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              :d="internalSort?.dir === 'desc' ? 'M12 5v14m0 0-6-6m6 6 6-6' : 'M12 19V5m0 0-6 6m6-6 6 6'"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
      <TableColumnSettings
        v-if="showSettings"
        class="ml-auto"
        :headers="localHeaders"
        :density="localDensity"
        :density-toggle="densityToggle"
        @update:headers="onSettingsHeaders"
        @update:density="onSettingsDensity"
        @reset="resetAll"
      />
    </div>

    <!--
      Нижче `md` ця обгортка лишається в потоці порожньою (контейнер
      прокрутки всередині сховано, картки — сусідній вузол). Саме тому
      тут `min-h-0` без `flex-1`: порожній `flex-1` з'їв би весь вільний
      простір і зіштовхнув картки за екран.
    -->
    <div class="relative" :class="fill ? 'flex min-h-0 flex-col' : ''">
      <!--
        bg-card на контейнері обов'язковий, а не косметика: компонент і сам
        малює card у трьох місцях — кнопку налаштувань, градієнт прокрутки і
        оверлей «Оновлення…». Без власної поверхні вони лягають на те, що
        просвічує крізь прозорі рядки (типово bg-main), і кнопка налаштувань
        стає світлою плямою над останньою колонкою.
      -->
      <div
        ref="scrollEl"
        class="scrollbar-thin relative overflow-auto rounded-card border border-line bg-card"
        :class="[mobileCards ? 'hidden md:block' : '', fill ? 'min-h-0' : '']"
        :style="!fill && maxHeight ? { maxHeight } : undefined"
        @scroll.passive="measure"
      >
        <!--
          border-separate з нульовим інтервалом, а НЕ border-collapse:
          злиті межі не малюються під закріпленою шапкою — вона отримує
          власний контекст малювання, і лінія під нею зникає рівно на час
          прокрутки. Роздільники рядків тому — псевдоелементи комірок.

          Нульовий інтервал заданий інлайново, а не класом border-spacing-0:
          аудит стилів у check:docs читає будь-яке `border-*` як колірну
          утиліту й шукає токен «spacing-0».
        -->
        <table
          class="w-full border-separate"
          :aria-busy="loading || undefined"
          :aria-multiselectable="selectable || undefined"
          :style="{ tableLayout: 'fixed', minWidth: `${tableMinWidth}px`, borderSpacing: '0' }"
        >
          <!--
            Ширини живуть ТУТ, а не на кожній комірці. За table-layout: fixed
            враховується лише перший рядок, тож інлайновий width на кожному
            <td> був би мертвим стилем, помноженим на кількість рядків.
            Колонка без width (flex) забирає залишок — це весь механізм, без JS.
          -->
          <colgroup>
            <col v-if="selectable" :style="{ width: `${SELECTION_COLUMN_WIDTH}px` }" />
            <col
              v-for="header in visibleHeaders"
              :key="header.value"
              :style="header.flex ? undefined : { width: `${header.width ?? COLUMN_DEFAULT_WIDTH}px` }"
            />
          </colgroup>

          <thead>
            <tr>
              <th
                v-if="selectable"
                scope="col"
                class="border-b border-line bg-subtle"
                :class="[
                  densitySelectionClass,
                  canStickHeader ? 'sticky top-0' : '',
                  stickyColumn ? 'sticky left-0 z-30' : 'z-20',
                ]"
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
                class="group/th relative border-b border-line bg-subtle font-medium text-muted"
                :class="[
                  densityClass,
                  alignClass(header),
                  canStickHeader ? 'sticky top-0' : '',
                  isStickyColumn(header) ? 'sticky z-30' : 'z-20',
                  isStickyColumn(header) && canScrollLeft ? 'ui-table-sticky-edge' : '',
                ]"
                :style="isStickyColumn(header) ? stickyColumnStyle : undefined"
              >
                <slot :name="`header-${header.value}`" :header="header">
                  <button
                    v-if="header.sortable"
                    type="button"
                    class="group relative inline-flex max-w-full items-center gap-1 rounded-control transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:top-1/2 pointer-coarse:after:h-12 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"
                    @click="toggleSort(header)"
                  >
                    <!-- Зона дотику — 45px заввишки (h-12), але не ширша за
                         підпис: праворуч у комірці живе ручка зміни ширини. -->
                    <span class="truncate">{{ header.text }}</span>
                    <!-- Привид-шеврон: підказка, що колонка взагалі сортується.
                         На дотику наведення не буває — там привид видно завжди. -->
                    <svg
                      class="h-3 w-3 shrink-0 transition-opacity"
                      :class="
                        internalSort?.by === header.value
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-40 group-focus-visible:opacity-40 pointer-coarse:opacity-40'
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

                <!-- Хват ресайзу проявляється на наведенні на заголовок:
                     інакше про можливість тягнути можна дізнатися лише
                     випадково, наштовхнувшись на невидиму смужку. touch-none
                     обов'язковий — без нього браузер забирає горизонтальний
                     жест собі як прокрутку. -->
                <span
                  v-if="isResizable(header)"
                  class="absolute inset-y-1.5 right-0 w-1 cursor-col-resize touch-none rounded-full bg-line-strong opacity-0 transition-opacity group-hover/th:opacity-100 hover:bg-accent-solid"
                  :class="resizing?.value === header.value ? 'bg-accent-solid opacity-100' : ''"
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
              <tr v-for="row in skeletonRows" :key="`sk-${row}`" class="bg-card">
                <td v-if="selectable" class="relative" :class="[densitySelectionClass, ROW_SEPARATOR]">
                  <UiSkeleton class="h-4 w-4 rounded-control" />
                </td>
                <td
                  v-for="header in visibleHeaders"
                  :key="header.value"
                  class="relative"
                  :class="[densityClass, ROW_SEPARATOR]"
                >
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
              <td :colspan="columnCount" class="p-0">
                <slot name="empty">
                  <p class="px-4 py-10 text-center text-sm text-muted">{{ emptyText }}</p>
                </slot>
              </td>
            </tr>

            <template v-else>
              <!--
                Клікабельний рядок лишається рядком: role="button" на <tr>
                стирав семантику таблиці (комірки більше не пов'язані із
                заголовками) і робив прапорець та кнопки в комірках
                вкладеними в кнопку — для скрінрідера їх не існувало.
                Фокусований рядок скрінрідер зачитує вмістом, Enter/Space
                і клік у режимі читання активують його так само.
              -->
              <tr
                v-for="item in sortedItems"
                :key="String(item[keyRow])"
                class="transition-colors"
                :class="[
                  // Тло рядка непрозоре ЗАВЖДИ, а не лише з tableId: під
                  // закріпленою колонкою й градієнтами прокрутки крізь
                  // прозорий рядок просвічувало б тло сторінки.
                  // Підсвітка на наведенні — і в некликабельній таблиці: у
                  // широкому рядку око губить, до якого запису належить
                  // комірка праворуч.
                  selectable && selectedSet.has(item[keyRow] as string | number)
                    ? 'bg-primary-50'
                    : 'bg-card hover:bg-hover',
                  rowClickable ? `cursor-pointer focus:outline-none ${ROW_FOCUS_RING}` : '',
                  rowClass?.(item),
                ]"
                :tabindex="rowClickable ? 0 : undefined"
                :aria-selected="selectable ? selectedSet.has(item[keyRow] as string | number) : undefined"
                @click="onRowActivate($event, item)"
                @keydown="onRowKeydown($event, item)"
              >
                <!--
                  @click.stop обов'язковий: без нього перемикання прапорця
                  ще й «активує» рядок, і rowClickable-таблиця відкриває
                  картку щоразу, коли її намагаються лише виділити.
                -->
                <td
                  v-if="selectable"
                  class="relative bg-inherit"
                  :class="[
                    densitySelectionClass,
                    ROW_SEPARATOR,
                    stickyColumn ? 'sticky left-0 z-10' : '',
                  ]"
                  @click.stop
                  @keydown.stop
                  @pointerdown="pendingShift = $event.shiftKey"
                  @mousedown="onSelectionMousedown"
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
                  class="relative bg-inherit text-ink"
                  :class="[
                    densityClass,
                    ROW_SEPARATOR,
                    alignClass(header),
                    header.align === 'right' ? 'tabular-nums' : '',
                    isStickyColumn(header) ? 'sticky z-10' : '',
                    isStickyColumn(header) && canScrollLeft ? 'ui-table-sticky-edge' : '',
                  ]"
                  :style="isStickyColumn(header) ? stickyColumnStyle : undefined"
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
      </div>

      <!--
        Оверлей оновлення: дані вже є, але йде повторний запит. Заміняти їх
        скелетоном було б гірше — таблиця блимала б на кожному фільтрі.

        Стоїть ЗОВНІ контейнера прокрутки: усередині він прокручувався б
        разом із рядками, і напис «Оновлення…» їхав би за край видимої
        області рівно тоді, коли таблиця довша за екран.
      -->
      <div
        v-if="loading && items.length > 0"
        class="absolute inset-0 items-start justify-center rounded-card bg-card/60 pt-12 backdrop-blur-[1px]"
        :class="mobileCards ? 'hidden md:flex' : 'flex'"
        aria-hidden="true"
      >
        <span class="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs text-muted shadow-card">
          <svg class="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle class="opacity-30" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
          Оновлення…
        </span>
      </div>

      <!--
        Афорданси прокрутки: без них не видно, що праворуч є ще колонки.
        Лівий не малюється при закріпленій колонці — він лягав би просто на
        неї, а край там і так позначає тінь.
      -->
      <div
        v-if="canScrollLeft && !stickyColumn"
        class="pointer-events-none absolute inset-y-0 left-0 w-6 rounded-l-card bg-gradient-to-r from-card to-transparent"
        :class="mobileCards ? 'hidden md:block' : ''"
        aria-hidden="true"
      />
      <!-- right-0 обов'язковий: без нього absolute-елемент лишається на
           статичній позиції, тобто ліворуч, і градієнт «кінця таблиці»
           малювався поверх ПЕРШОЇ колонки. -->
      <div
        v-if="canScrollRight"
        class="pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r-card bg-gradient-to-l from-card to-transparent"
        :class="mobileCards ? 'hidden md:block' : ''"
        aria-hidden="true"
      />
    </div>

    <!--
      Мобільні картки з ТИХ САМИХ слотів cell-* — і з тими самими станами.
      Без них телефон при першому завантаженні показував порожнечу
      (скелетон жив у схованій таблиці), при повторному — не показував
      нічого (оверлей теж hidden до md), а слот #empty підмінявся голим
      emptyText.

      flex-col з gap, а не space-y: оверлей нижче — такий самий нащадок, і
      space-y дав би останній картці нижній відступ щоразу, коли оверлей
      з'являється, — список підстрибував би на кожному оновленні.
    -->
    <div v-if="mobileCards" class="relative flex flex-col gap-2 md:hidden" :aria-busy="loading || undefined">
      <template v-if="showSkeleton">
        <div
          v-for="row in skeletonRows"
          :key="`msk-${row}`"
          class="space-y-1.5 rounded-card border border-line bg-card p-3"
          aria-hidden="true"
        >
          <!-- h-5 — висота рядка text-sm у картці: скелетон повторює
               геометрію пар «назва — значення», а не малює довільні смуги. -->
          <div v-for="header in visibleHeaders" :key="header.value" class="flex h-5 items-center justify-between gap-3">
            <UiSkeleton class="h-3 w-16" />
            <UiSkeleton class="h-3" :style="{ width: `${25 + ((row * 17 + header.value.length * 13) % 30)}%` }" />
          </div>
        </div>
      </template>

      <div v-else-if="showEmpty" class="rounded-card border border-line bg-card">
        <slot name="empty">
          <p class="px-4 py-10 text-center text-sm text-muted">{{ emptyText }}</p>
        </slot>
      </div>

      <template v-else>
      <div
        v-for="item in sortedItems"
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
        <div
          v-if="selectable"
          class="pt-0.5"
          @pointerdown="pendingShift = $event.shiftKey"
          @mousedown="onSelectionMousedown"
        >
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
          @click="onRowActivate($event, item)"
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
              <!--
                `break-words` обов'язковий, а не косметика. `min-w-0` дозволяє
                комірці стиснутись, але НЕ дозволяє розірвати слово: значення
                на кшталт ідентифікатора чи ключа (`product.creative.system`,
                URL, хеш) лишається одним неподільним токеном і розпирає
                картку. Тоді сторінка отримує горизонтальну прокрутку, якої на
                телефоні бути не повинно — виміряно 442px вмісту на екрані
                320px. Клас впливає лише на слова, ЩО НЕ ВМІЩАЮТЬСЯ; звичайний
                текст переносить далі по пробілах.
              -->
              <dd class="min-w-0 text-right break-words text-ink">
                <slot :name="`cell-${header.value}`" :item="item" :header="header">
                  {{ item[header.value] ?? '—' }}
                </slot>
              </dd>
            </div>
          </dl>
        </slot>
        </div>
      </div>
      </template>

      <!--
        Той самий оверлей оновлення, що над таблицею. Пігулка sticky: список
        карток на телефоні буває на кілька екранів, і напис угорі оверлею
        їхав би за край рівно тоді, коли користувач прогорнув униз.
        Запасне значення 0px — для проєкту без токена висоти шапки.
      -->
      <div
        v-if="loading && items.length > 0"
        class="absolute inset-0 flex items-start justify-center rounded-card bg-card/60 pt-6 backdrop-blur-[1px]"
        aria-hidden="true"
      >
        <span class="sticky top-[calc(var(--header-height,0px)+0.75rem)] inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs text-muted shadow-card">
          <svg class="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle class="opacity-30" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
          Оновлення…
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * Край закріпленої колонки під час горизонтальної прокрутки: тінь каже,
 * що решта колонок їде ПІД неї. Без тіні стик двох однакових поверхонь
 * невидимий, і колонки просто «зникають». Той самий стиль, що в
 * UiTreeTable.
 */
.ui-table-sticky-edge {
  box-shadow: 4px 0 8px -4px color-mix(in oklab, var(--ink) 18%, transparent);
  clip-path: inset(0 -12px 0 0);
}

/*
 * Останній рядок не малює роздільник: він збігся б із межею контейнера і
 * дав подвійну лінію. Правилом у scoped-CSS, а не утилітою
 * `last:[&>td]:after:hidden` — перевірено на зібраному CSS: таке
 * поєднання варіантів Tailwind не генерує взагалі, і клас у розмітці
 * мовчки нічого не робить. Правило, якого немає, виглядає точно як
 * правило, що не спрацювало.
 */
tbody tr:last-child > td::after {
  display: none;
}

</style>
