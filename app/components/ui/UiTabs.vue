<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

export interface TabItem {
  id: string
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    /** Панелі вкладок. */
    tabs: TabItem[]
    /** Активна вкладка. Використовуйте через `v-model`. */
    modelValue?: string
    /**
     * Вигляд. `underline` — класичні вкладки з лінією, `pills` — сегментний
     * перемикач (фонова підкладка, активна сегмента «піднята»).
     */
    variant?: 'underline' | 'pills'
    /**
     * Висота кнопок вкладок. `sm` — для вкладок усередині панелі
     * інструментів чи картки; на дотику зону 45×45 дає невидимий ::after.
     */
    size?: 'sm' | 'md'
    /**
     * Розташування списку. `vertical` ставить вкладки стовпчиком ліворуч від
     * панелі — для сторінок налаштувань із багатьма розділами; клавіатура
     * тоді перемикає стрілками ↑/↓, а не ←/→.
     */
    orientation?: 'horizontal' | 'vertical'
    /**
     * Назва query-параметра, з яким синхронізується активна вкладка.
     * Напр. `"tab"` — стан читається з `?tab=` після монтування і пишеться
     * туди через `router.replace`. Потрібен лише для вкладок, що мають
     * переживати перезавантаження сторінки. Без встановленого роутера
     * нічого не синхронізує.
     */
    queryParam?: string
    /** Доступна назва для `role="tablist"`. */
    ariaLabel?: string
  }>(),
  {
    modelValue: undefined,
    variant: 'underline',
    size: 'md',
    orientation: 'horizontal',
    queryParam: undefined,
    ariaLabel: 'Вкладки',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  /** Користувач перемкнув вкладку: клік, клавіатура або «Назад/Вперед» у браузері. */
  change: [id: string]
}>()

defineSlots<{
  /** Вміст активної панелі, якщо не задано слот `panel-<id>`. */
  default?: () => unknown
  /** `panel-<id>` — вміст панелі вкладки з цим id. Рендериться лише активна. */
  [key: `panel-${string}`]: () => unknown
  /** `tab-<id>` — власний вміст усередині семантичної кнопки вкладки. */
  [key: `tab-${string}`]: (props: { tab: TabItem; active: boolean }) => unknown
}>()

/*
 * Роутер — з globalProperties, а не імпортом vue-router. Імпорт робив пакет
 * обов'язковим навіть для вкладок без queryParam: у Vite-проєкті без
 * роутера компонент не збирався, а без встановленого роутера кожен
 * екземпляр сипав попередження про injection. Тепер без роутера queryParam
 * просто нічого не синхронізує.
 */
interface QueryRouter {
  currentRoute: { value: { query: Record<string, unknown> } }
  replace(to: { query: Record<string, unknown> }): unknown
}

const globals = getCurrentInstance()?.appContext.config.globalProperties as { $router?: unknown } | undefined
const router = globals?.$router as QueryRouter | undefined

const baseId = useId()
const tabDomId = (id: string) => `${baseId}-tab-${id}`
const panelDomId = (id: string) => `${baseId}-panel-${id}`
const tablistEl = ref<HTMLElement | null>(null)
const vertical = computed(() => props.orientation === 'vertical')

/*
 * Кнопки — з DOM за id, а не з масиву template-ref. Масив після видалення
 * вкладки з середини отримував null на місці сусідньої кнопки (unmount
 * старого вузла викликав ref-функцію зі старим індексом уже ПІСЛЯ патчу
 * нового), і фокус стрілками туди мовчки не переходив.
 */
function tabButtons(): HTMLElement[] {
  return Array.from(tablistEl.value?.children ?? []).filter(
    (element): element is HTMLElement => element.getAttribute('role') === 'tab',
  )
}

const buttonFor = (id: string) => tabButtons().find((element) => element.id === tabDomId(id))

/*
 * Індикатор активної вкладки — один елемент, що КОВЗАЄ між кнопками, а не
 * межа на кожній кнопці окремо. Око тоді бачить переміщення, а не
 * зникнення в одному місці й появу в іншому: зрозуміліше, куди перейшли.
 *
 * До монтування (SSR, перший кадр) індикатора немає — межу малює сама
 * активна кнопка, тож прередерений HTML виглядає так само. Після
 * вимірювання кнопка віддає межу індикатору.
 */
const indicator = ref<{ left: number; top: number; width: number; height: number } | null>(null)
let resizeObserver: ResizeObserver | null = null

function measureIndicator() {
  const button = buttonFor(active.value)
  if (!button || !tablistEl.value) {
    indicator.value = null
    return
  }
  const next = {
    left: button.offsetLeft,
    top: button.offsetTop,
    width: button.offsetWidth,
    height: button.offsetHeight,
  }
  const current = indicator.value
  // Observer дзвонить на кожну кнопку окремо — без порівняння кожен дзвінок
  // давав би зайвий ререндер з тими самими числами.
  if (
    current
    && current.left === next.left
    && current.top === next.top
    && current.width === next.width
    && current.height === next.height
  ) return
  indicator.value = next
}

const indicatorStyle = computed(() => {
  if (!indicator.value) return undefined
  const { left, top, width, height } = indicator.value
  if (props.variant === 'pills') {
    return { transform: `translate(${left}px, ${top}px)`, width: `${width}px`, height: `${height}px` }
  }
  return vertical.value
    ? { transform: `translateY(${top}px)`, height: `${height}px` }
    : { transform: `translateX(${left}px)`, width: `${width}px` }
})

/*
 * Спостерігаємо КОЖНУ кнопку, а не лише список. У underline список —
 * блочний flex на всю ширину контейнера: коли вкладка ширшає (довантажився
 * веб-шрифт, у слоті `tab-<id>` виріс лічильник), розмір списку не
 * змінюється, observer мовчить, і індикатор лишається під старою шириною.
 */
function observeTabs() {
  if (!resizeObserver || !tablistEl.value) return
  resizeObserver.disconnect()
  resizeObserver.observe(tablistEl.value)
  for (const button of tabButtons()) resizeObserver.observe(button)
}

const firstEnabled = computed(
  () => props.tabs.find((tab) => !tab.disabled)?.id ?? props.tabs[0]?.id ?? '',
)
const isEnabledId = (id: string | undefined): id is string =>
  !!id && props.tabs.some((tab) => tab.id === id && !tab.disabled)
const active = ref(isEnabledId(props.modelValue) ? props.modelValue : firstEnabled.value)

function queryValue(): string | undefined {
  if (!props.queryParam) return undefined
  const value = router?.currentRoute.value.query[props.queryParam]
  return typeof value === 'string' ? value : undefined
}

function syncQuery(id: string) {
  if (!props.queryParam || !router) return
  // Перша вкладка не пише параметр: URL лишається чистим для стану за замовчуванням.
  const wanted = id === firstEnabled.value ? undefined : id
  if (queryValue() === wanted) return
  const query = { ...router.currentRoute.value.query, [props.queryParam]: wanted }
  if (wanted === undefined) delete query[props.queryParam]
  void router.replace({ query })
}

/*
 * Єдиний шлях зміни вкладки. Раніше їх було чотири, і кожен забував щось
 * своє: вкладка з URL (початкова і «Назад/Вперед») не доходила до v-model і
 * не давала change — батько «скидав» вкладку на значення, яке вже вважав
 * поточним, і нічого не відбувалося; зміна v-model згори не писала URL, і
 * перезавантаження повертало стару вкладку.
 *
 * source вирішує лише побічні ефекти:
 *   user    — клік чи клавіатура: v-model, change, URL;
 *   history — «Назад/Вперед»: v-model і change, URL уже правильний;
 *   restore — ?param= при монтуванні: лише v-model, це не дія користувача;
 *   model   — v-model змінили згори: лише URL, батько значення вже знає.
 */
type Source = 'user' | 'history' | 'restore' | 'model'

function setActive(id: string, source: Source) {
  if (id === active.value || !isEnabledId(id)) return
  active.value = id
  if (source !== 'model') emit('update:modelValue', id)
  if (source === 'user' || source === 'history') emit('change', id)
  if (source === 'user' || source === 'model') syncQuery(id)
}

watch(
  () => props.modelValue,
  (value) => {
    if (value === undefined || value === active.value) return
    if (isEnabledId(value)) setActive(value, 'model')
    // Вимкнена чи неіснуюча вкладка не показується — і батько має про це
    // дізнатися, інакше його v-model розходиться з тим, що на екрані.
    else emit('update:modelValue', active.value)
  },
)

watch(
  () => props.tabs,
  () => {
    if (isEnabledId(active.value)) return
    const next = firstEnabled.value
    active.value = next
    if (next) emit('update:modelValue', next)
    if (isEnabledId(next)) syncQuery(next)
  },
  { deep: true },
)

// «Назад/Вперед» у браузері: вкладка слідує за URL. Відсутній параметр
// свідомо ігноруємо — сторінка, що йде під час page-transition, бачить URL
// НАСТУПНОЇ сторінки і інакше перемикалась би на першу вкладку.
watch(queryValue, (value) => {
  if (value !== undefined) setActive(value, 'history')
})

function select(id: string) {
  setActive(id, 'user')
}

onMounted(() => {
  /*
   * URL читається тут, а не в setup. Прередерена сторінка рендериться без
   * ?tab=, і клієнт, що читав параметр ще до гідрації, отримував
   * розбіжність: стара вкладка лишалася з активними класами поруч із новою.
   */
  const fromQuery = queryValue()
  if (isEnabledId(fromQuery) && fromQuery !== active.value) setActive(fromQuery, 'restore')
  // Невалідний modelValue (неіснуюча чи вимкнена вкладка) — повідомити
  // батька, що показано насправді.
  else if (props.modelValue !== undefined && props.modelValue !== active.value) {
    emit('update:modelValue', active.value)
  }

  measureIndicator()
  // Ширина кнопки міняється зі шрифтом і переносом — індикатор мусить
  // слідувати, інакше після зміни вікна він стоїть під сусіднім словом.
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measureIndicator())
    observeTabs()
  }
})

onBeforeUnmount(() => resizeObserver?.disconnect())

// Після будь-якої зміни активної вкладки чи набору кнопок — переміряти.
// nextTick: кнопки вже мають бути в DOM у новому складі.
watch(
  [active, () => props.tabs, () => props.variant, () => props.size, () => props.orientation],
  () =>
    void nextTick(() => {
      observeTabs()
      measureIndicator()
    }),
  { deep: true },
)

function onKeydown(event: KeyboardEvent, index: number) {
  const nextKey = vertical.value ? 'ArrowDown' : 'ArrowRight'
  const previousKey = vertical.value ? 'ArrowUp' : 'ArrowLeft'
  if (![nextKey, previousKey, 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const enabled = props.tabs.map((tab, i) => ({ tab, i })).filter(({ tab }) => !tab.disabled)
  if (!enabled.length) return
  let pos = enabled.findIndex(({ i }) => i === index)
  if (pos === -1) pos = 0
  if (event.key === nextKey) pos = (pos + 1) % enabled.length
  else if (event.key === previousKey) pos = (pos - 1 + enabled.length) % enabled.length
  else if (event.key === 'Home') pos = 0
  else pos = enabled.length - 1
  const target = enabled[pos]!
  select(target.tab.id)
  void nextTick(() => buttonFor(target.tab.id)?.focus())
}

/*
 * Контейнер прокрутки (overflow-x-auto — отже й overflow-y) обрізає все, що
 * виходить за його рамку. Без полів він різав фокус-кільце (2px) underline:
 * у крайньої вкладки — збоку, а на десктопі в кожної ще й згори й знизу,
 * навіть коли прокручувати нічого (у pills кільце вміщує власний p-1
 * списку). На дотику ж різалась невидима зона 45×45: тап на 2px вище
 * кнопки вже не влучав, а стрічка ще й прокручувалась вертикально на ~3px.
 * Поля вміщують і кільце, і зону (на coarse-вказівнику — вищі), від'ємний
 * марджин компенсує їх, тож верстка навколо не зсувається. scroll-px-1 —
 * той самий відступ, коли фокус докручує вкладку (onScrollerFocusin).
 */
const scrollerClass = computed(() =>
  vertical.value
    ? 'shrink-0'
    : 'scrollbar-none -m-1 overflow-x-auto p-1 scroll-px-1 pointer-coarse:-my-1.5 pointer-coarse:py-1.5',
)

/*
 * Chromium на фокус (стрілки, Tab) докручує смугу лише до вкладки, схованої
 * повністю, і то по центру; частково видиму лишає обрізаною разом із
 * фокус-кільцем. `nearest` разом зі scroll-padding смуги показує вкладку
 * цілою. Лише для фокуса з клавіатури: прокрутка посеред кліку чи тапу
 * зсунула б вкладку з-під пальця.
 */
function onScrollerFocusin(event: FocusEvent) {
  const target = event.target as HTMLElement
  if (target.matches(':focus-visible')) target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

// Межа underline — на самому списку, а не на обгортці: паддінг обгортки
// вище інакше відсунув би її від індикатора.
const tablistClass = computed(() => {
  if (props.variant === 'pills') {
    return [
      'relative gap-1 rounded-control bg-hover p-1',
      vertical.value ? 'flex flex-col' : 'inline-flex min-w-max items-center',
    ]
  }
  return vertical.value
    ? 'relative flex flex-col gap-1 border-e border-line'
    : 'relative flex min-w-max gap-1 border-b border-line'
})

const indicatorClass = computed(() => {
  if (props.variant === 'pills') {
    return 'top-0 left-0 rounded-[calc(var(--radius-control)_-_0.125rem)] bg-card shadow-card'
  }
  return vertical.value
    ? 'top-0 end-0 w-0.5 rounded-full bg-accent-solid'
    : 'bottom-0 left-0 h-0.5 rounded-full bg-accent-solid'
})

function tabClass(tab: TabItem) {
  const isActive = tab.id === active.value
  return [
    // relative — і для індикатора pills (кнопка над підкладкою), і для
    // невидимої зони дотику нижче: без нього ::after прив'язувався до
    // контейнера прокрутки, а не до кнопки.
    'relative inline-flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    vertical.value ? 'justify-start text-left' : 'justify-center',
    // Невидима зона на дотику: щонайменше 45×45 і не вужча за саму кнопку —
    // широка вертикальна вкладка інакше мала б зону лише посередині.
    "pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-[''] pointer-coarse:after:h-12 pointer-coarse:after:w-[max(100%,3rem)]",
    tab.disabled ? 'cursor-not-allowed opacity-50' : '',
    props.variant === 'underline'
      ? [
          props.size === 'sm' ? 'h-9 px-3 text-sm md:h-8' : 'h-10 px-3.5 text-sm md:h-9',
          vertical.value ? 'rounded-s-control border-e-2' : 'rounded-t-control border-b-2',
          isActive
            ? [indicator.value ? 'border-transparent' : 'border-accent-solid', 'text-accent']
            : 'border-transparent text-muted hover:border-line-strong hover:text-ink',
        ]
      : [
          props.size === 'sm' ? 'h-8 px-3 text-xs md:h-7' : 'h-9 px-3.5 text-sm md:h-8',
          'rounded-[calc(var(--radius-control)_-_0.125rem)]',
          isActive ? [indicator.value ? '' : 'bg-card shadow-card', 'text-ink'] : 'text-muted hover:text-ink',
        ],
  ]
}
</script>

<template>
  <!-- min-w-0: у flex-рядку батька вкладки інакше тримали б ширину всіх
       кнопок у рядок (max-content), і прокрутка списку вкладок на вузькому
       екрані не вмикалася б ніколи — ряд виходив за край. -->
  <div :class="vertical ? 'flex min-w-0 items-start gap-6' : 'min-w-0'">
    <div :class="scrollerClass" @focusin="onScrollerFocusin">
      <div
        ref="tablistEl"
        role="tablist"
        :aria-label="ariaLabel"
        :aria-orientation="orientation"
        :class="tablistClass"
      >
        <!-- Індикатор стоїть ПЕРЕД кнопками в DOM: у pills він — підкладка
             активної, тож має лежати нижче тексту. -->
        <span
          v-if="indicator"
          aria-hidden="true"
          class="pointer-events-none absolute transition-[transform,width,height] duration-(--duration-slow) ease-emphasized"
          :class="indicatorClass"
          :style="indicatorStyle"
        />
        <template v-for="(tab, index) in tabs" :key="tab.id">
          <button
            :id="tabDomId(tab.id)"
            type="button"
            role="tab"
            :aria-selected="tab.id === active"
            :aria-controls="panelDomId(tab.id)"
            :tabindex="tab.id === active ? 0 : -1"
            :disabled="tab.disabled"
            :class="tabClass(tab)"
            @click="!tab.disabled && select(tab.id)"
            @keydown="onKeydown($event, index)"
          >
            <slot :name="`tab-${tab.id}`" :tab="tab" :active="tab.id === active">
              {{ tab.label }}
            </slot>
          </button>
        </template>
      </div>
    </div>

    <!-- tabindex="0": панель без жодного фокусованого елемента (лише текст)
         інакше недосяжна з клавіатури — Tab з вкладки перестрибував би її. -->
    <template v-for="tab in tabs" :key="tab.id">
      <div
        v-if="tab.id === active"
        :id="panelDomId(tab.id)"
        role="tabpanel"
        tabindex="0"
        :aria-labelledby="tabDomId(tab.id)"
        :class="vertical ? 'min-w-0 flex-1' : 'mt-4'"
      >
        <slot :name="`panel-${tab.id}`">
          <slot />
        </slot>
      </div>
    </template>
  </div>
</template>
