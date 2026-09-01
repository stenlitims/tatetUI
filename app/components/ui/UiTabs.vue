<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onBeforeUpdate, onMounted, ref, useId, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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
     * Назва query-параметра, з яким синхронізується активна вкладка.
     * Напр. `"tab"` — стан читається з `?tab=` і пишеться туди через
     * `router.replace`. Потрібен лише для вкладок, що мають переживати
     * перезавантаження сторінки.
     */
    queryParam?: string
    /** Доступна назва для `role="tablist"`. */
    ariaLabel?: string
  }>(),
  { modelValue: undefined, variant: 'underline', size: 'md', queryParam: undefined, ariaLabel: 'Вкладки' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  /** Активна вкладка змінилася (клік, клавіатура або навігація за URL). */
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

const route = useRoute()
const router = useRouter()

const baseId = useId()
const tablistEl = ref<HTMLElement | null>(null)
const tabButtonEls = ref<(HTMLElement | null)[]>([])

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
  const index = props.tabs.findIndex((tab) => tab.id === active.value)
  const button = tabButtonEls.value[index]
  if (!button || !tablistEl.value) {
    indicator.value = null
    return
  }
  indicator.value = {
    left: button.offsetLeft,
    top: button.offsetTop,
    width: button.offsetWidth,
    height: button.offsetHeight,
  }
}

const indicatorStyle = computed(() => {
  if (!indicator.value) return undefined
  const { left, top, width, height } = indicator.value
  return props.variant === 'underline'
    ? { transform: `translateX(${left}px)`, width: `${width}px` }
    : { transform: `translate(${left}px, ${top}px)`, width: `${width}px`, height: `${height}px` }
})

onMounted(() => {
  measureIndicator()
  // Ширина кнопки міняється зі шрифтом і переносом — індикатор мусить
  // слідувати, інакше після зміни вікна він стоїть під сусіднім словом.
  if (typeof ResizeObserver !== 'undefined' && tablistEl.value) {
    resizeObserver = new ResizeObserver(() => measureIndicator())
    resizeObserver.observe(tablistEl.value)
  }
})

onBeforeUnmount(() => resizeObserver?.disconnect())

// Template-refs у v-for накопичуються між рендерами: без скидання масив
// тримав би хибні елементи після зміни набору вкладок (той самий патерн,
// що в UiSelect).
onBeforeUpdate(() => {
  tabButtonEls.value = []
})

const firstEnabled = computed(
  () => props.tabs.find((tab) => !tab.disabled)?.id ?? props.tabs[0]?.id ?? '',
)
const isEnabledId = (id: string) => props.tabs.some((tab) => tab.id === id && !tab.disabled)
const active = ref(
  props.modelValue && isEnabledId(props.modelValue) ? props.modelValue : firstEnabled.value,
)

// Відновлення стану з URL має пріоритет над props.modelValue.
if (props.queryParam && typeof route.query[props.queryParam] === 'string') {
  const fromQuery = route.query[props.queryParam] as string
  if (isEnabledId(fromQuery)) active.value = fromQuery
}

watch(
  () => props.modelValue,
  (value) => {
    if (value !== undefined && value !== active.value && isEnabledId(value)) active.value = value
  },
)

watch(
  () => props.tabs,
  () => {
    if (isEnabledId(active.value)) return
    const next = firstEnabled.value
    active.value = next
    if (next) emit('update:modelValue', next)
  },
  { deep: true },
)

// Назад/вперед у браузері: вкладка слідує за URL.
watch(
  () => (props.queryParam ? route.query[props.queryParam] : undefined),
  (value) => {
    if (typeof value === 'string' && isEnabledId(value)) {
      if (value !== active.value) active.value = value
    }
  },
)

function syncQuery(id: string) {
  if (!props.queryParam) return
  const query = { ...route.query, [props.queryParam]: id }
  // Перший таб не пише параметр: URL лишається чистим для стану за замовчуванням.
  if (id === firstEnabled.value) delete query[props.queryParam]
  void router.replace({ query })
}

function select(id: string) {
  if (id === active.value || !isEnabledId(id)) return
  active.value = id
  emit('update:modelValue', id)
  emit('change', id)
  syncQuery(id)
}

// Після будь-якої зміни активної вкладки чи набору кнопок — переміряти.
// nextTick: кнопки вже мають бути в DOM у новому складі.
watch([active, () => props.tabs, () => props.variant], () => void nextTick(measureIndicator), {
  deep: true,
})

function onKeydown(event: KeyboardEvent, index: number) {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const enabled = props.tabs.map((tab, i) => ({ tab, i })).filter(({ tab }) => !tab.disabled)
  if (!enabled.length) return
  let pos = enabled.findIndex(({ i }) => i === index)
  if (pos === -1) pos = 0
  if (event.key === 'ArrowRight') pos = (pos + 1) % enabled.length
  else if (event.key === 'ArrowLeft') pos = (pos - 1 + enabled.length) % enabled.length
  else if (event.key === 'Home') pos = 0
  else pos = enabled.length - 1
  const target = enabled[pos]!
  select(target.tab.id)
  void nextTick(() => tabButtonEls.value[target.i]?.focus())
}
</script>

<template>
  <div>
    <div class="scrollbar-none overflow-x-auto" :class="variant === 'underline' ? 'border-b border-line' : ''">
      <div
        ref="tablistEl"
        role="tablist"
        :aria-label="ariaLabel"
        :class="
          variant === 'underline'
            ? 'relative flex min-w-max gap-1'
            : 'relative inline-flex min-w-max items-center gap-1 rounded-control bg-hover p-1'
        "
      >
        <!-- Індикатор стоїть ПЕРЕД кнопками в DOM: у pills він — підкладка
             активної, тож має лежати нижче тексту. -->
        <span
          v-if="indicator"
          aria-hidden="true"
          class="pointer-events-none absolute transition-[transform,width,height] duration-(--duration-slow) ease-emphasized"
          :class="
            variant === 'underline'
              ? 'bottom-0 left-0 h-0.5 rounded-full bg-accent-solid'
              : 'top-0 left-0 rounded-[calc(var(--radius-control)_-_0.125rem)] bg-card shadow-card'
          "
          :style="indicatorStyle"
        />
        <template v-for="(tab, index) in tabs" :key="tab.id">
          <button
              :id="`${baseId}-tab-${tab.id}`"
              :ref="(el) => (tabButtonEls[index] = el as HTMLElement)"
              type="button"
              role="tab"
              :aria-selected="tab.id === active"
              :aria-controls="`${baseId}-panel-${tab.id}`"
              :tabindex="tab.id === active ? 0 : -1"
              :disabled="tab.disabled"
              :class="[
                // relative — і для індикатора pills (кнопка над підкладкою),
                // і для невидимої зони дотику нижче: без нього ::after
                // прив'язувався до контейнера прокрутки, а не до кнопки.
                'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                // Невидима зона 45×45 на дотику — кнопка вкладки лишається
                // компактною, як на десктопі (раніше h-11 розпирав панелі).
                'pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-[\'\'] pointer-coarse:after:h-12 pointer-coarse:after:w-12',
                tab.disabled ? 'cursor-not-allowed opacity-50' : '',
                variant === 'underline'
                  ? [
                      size === 'sm' ? 'h-9 px-3 text-sm md:h-8' : 'h-10 px-3.5 text-sm md:h-9',
                      'rounded-t-control border-b-2',
                      tab.id === active
                        ? [indicator ? 'border-transparent' : 'border-accent-solid', 'text-accent']
                        : 'border-transparent text-muted hover:border-line-strong hover:text-ink',
                    ]
                  : [
                      size === 'sm' ? 'h-8 px-3 text-xs md:h-7' : 'h-9 px-3.5 text-sm md:h-8',
                      'rounded-[calc(var(--radius-control)_-_0.125rem)]',
                      tab.id === active
                        ? [indicator ? '' : 'bg-card shadow-card', 'text-ink']
                        : 'text-muted hover:text-ink',
                    ],
              ]"
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

    <template v-for="tab in tabs" :key="tab.id">
      <div
        v-if="tab.id === active"
        :id="`${baseId}-panel-${tab.id}`"
        role="tabpanel"
        :aria-labelledby="`${baseId}-tab-${tab.id}`"
        class="mt-4"
      >
        <slot :name="`panel-${tab.id}`">
          <slot />
        </slot>
      </div>
    </template>
  </div>
</template>
