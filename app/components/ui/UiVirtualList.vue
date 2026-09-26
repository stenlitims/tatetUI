<!--
  `Record<string, any>`, а не `Record<string, unknown>`: під `unknown`
  жоден `interface` рядка не проходив обмеження («Index signature for type
  'string' is missing»). Те саме рішення, що в UiTable.
-->
<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '~/composables/useReducedMotion'

const props = withDefaults(
  defineProps<{
    /** Масив рядків. Порядок у масиві — порядок на екрані, компонент його не міняє. */
    items: T[]
    /**
     * Висота КОЖНОГО рядка в пікселях (число, не рядок).
     *
     * Це контракт компонента, а не налаштування: уся арифметика віртуалізації
     * — позиція діапазону, зміщення рядків, загальна висота полотна —
     * обчислюється множенням на це число. Рядки іншої висоти ламають
     * розрахунок: останні екрани списку або не показуються, або показуються
     * з дірками. Рядок має гарантовано вкладатися у задану висоту
     * (`truncate`, `line-clamp-*`, фіксована кількість рядків тексту).
     */
    itemHeight: number
    /** Висота контейнера прокрутки, напр. `"16rem"`. */
    height?: string
    /**
     * Скільки рядків за межами видимої зони тримати відрендереними з кожного
     * боку. Більший overscan — плавніший скрол, більший DOM.
     */
    overscan?: number
    /** Поле-ідентифікатор рядка для `:key`. */
    keyField?: string
    /** Доступна назва scrollable-списку. */
    ariaLabel?: string
  }>(),
  {
    height: '20rem',
    overscan: 5,
    keyField: 'id',
    ariaLabel: 'Віртуальний список',
  },
)

/*
 * defineSlots із generic="T" обов'язковий: для генеричних компонентів
 * vue-component-meta не читає слоти з шаблону (language-tools#3429), і
 * таблиця API лишилася б без секції «Слоти».
 */
defineSlots<{
  /** Обов'язковий рендер одного рядка. Висоту рядку задає сам компонент. */
  item: (props: { item: T; index: number }) => unknown
}>()

const scrollEl = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const normalizedItemHeight = computed(() =>
  Number.isFinite(props.itemHeight) && props.itemHeight > 0 ? props.itemHeight : 1,
)
const normalizedOverscan = computed(() =>
  Number.isFinite(props.overscan) ? Math.max(0, Math.floor(props.overscan)) : 0,
)

const visible = computed(() => {
  if (props.items.length === 0) return []
  const start = Math.max(
    0,
    Math.floor(scrollTop.value / normalizedItemHeight.value) - normalizedOverscan.value,
  )
  const end = Math.min(
    props.items.length - 1,
    Math.ceil((scrollTop.value + clientHeight.value) / normalizedItemHeight.value) +
      normalizedOverscan.value,
  )
  const rows: { item: T; index: number }[] = []
  for (let index = start; index <= end; index++) {
    const item = props.items[index]!
    rows.push({ item, index })
  }
  return rows
})

const totalHeight = computed(() => props.items.length * normalizedItemHeight.value)

/*
 * SSR-фолбек виходить із тієї ж формули, а не з окремої гілки: на сервері
 * scrollTop = 0, а clientHeight ще не виміряна й дорівнює дефолтним 600,
 * тож діапазон — перші ceil(600/itemHeight) рядків (+ overscan). Прередер
 * має вміст, і перший клієнтський рендер дає той самий діапазон — гідратація
 * без розбіжностей.
 */
const clientHeight = ref(600)

function onScroll() {
  const el = scrollEl.value
  if (!el) return
  scrollTop.value = el.scrollTop
  clientHeight.value = el.clientHeight
}

function measure() {
  const el = scrollEl.value
  if (!el) return
  clientHeight.value = el.clientHeight
}

const prefersReducedMotion = useReducedMotion()

/**
 * Прокручує список так, щоб рядок `index` опинився посередині вікна.
 * Клаймиться в [0, totalHeight - clientHeight], як будь-який scrollTop.
 */
function scrollToIndex(index: number) {
  const el = scrollEl.value
  if (!el || props.items.length === 0) return
  const normalizedIndex = Math.min(
    props.items.length - 1,
    Math.max(0, Math.floor(Number.isFinite(index) ? index : 0)),
  )
  const top = Math.min(
    Math.max(
      normalizedIndex * normalizedItemHeight.value -
        el.clientHeight / 2 +
        normalizedItemHeight.value / 2,
      0,
    ),
    Math.max(0, totalHeight.value - el.clientHeight),
  )
  el.scrollTo({
    top,
    // auto без анімації — вимога prefers-reduced-motion (як у UiModal).
    behavior: prefersReducedMotion.value ? 'auto' : 'smooth',
  })
}

defineExpose({
  /** Прокрутити до рядка за номером у `items` (центр вікна). */
  scrollToIndex,
})

/*
 * Висоту вікна треба перечитувати щоразу, коли змінюється сам контейнер, а
 * не лише вікно браузера. Раніше слухався тільки resize вікна, і новий
 * `height`, перетягнутий UiResizablePanels, згорнутий сайдбар чи монтаж у
 * схованій вкладці (висота 0 → шість рядків) лишали низ списку порожнім,
 * доки користувач не прокрутить. ResizeObserver ловить усе це; resize
 * вікна лишається запасним шляхом для середовищ без нього.
 */
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && scrollEl.value) {
    resizeObserver = new ResizeObserver(() => measure())
    resizeObserver.observe(scrollEl.value)
  }
})

// Клієнтська висота відома лише в браузері; саме з неї рахується діапазон.
if (typeof document !== 'undefined') {
  window.addEventListener('resize', measure, { passive: true })
}

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (typeof document !== 'undefined') {
    window.removeEventListener('resize', measure)
  }
})

// Новий `height` — нова висота вікна вже на наступному кадрі, без
// очікування на колбек спостерігача.
watch(
  () => props.height,
  () => void nextTick(measure),
)

// Зміна набору рядків чи висоти рядка зсовує діапазон — перечитуємо
// позицію. Якщо стара позиція скролу виходить за новий полотно (набір
// різко скоротився), браузер сам би притиснув scrollTop при першому
// прокручуванні — але visible рахується зі збереженого scrollTop.value ще
// ДО того, тож список рендерив би порожнє вікно. Скидаємо на 0 одразу.
watch([() => props.items.length, normalizedItemHeight], () => {
  onScroll()
  const el = scrollEl.value
  if (!el) return
  const maxTop = Math.max(0, totalHeight.value - clientHeight.value)
  if (el.scrollTop > maxTop) {
    el.scrollTop = 0
    scrollTop.value = 0
  }
})

const itemKey = (item: T, index: number) =>
  String(item[props.keyField] ?? `virtual-row-${index}`)
</script>

<template>
  <!--
    w-full: рядки позиціоновані абсолютно й ширини списку не дають, тож у
    flex-рядку батька список стискався до нуля — лишалася сама рамка.
    overscroll-contain: докрутивши до краю, палець не тягне сторінку.
  -->
  <div
    ref="scrollEl"
    role="list"
    tabindex="0"
    :aria-label="ariaLabel"
    class="w-full overflow-y-auto overscroll-contain rounded-card border border-line bg-card"
    :style="{ height }"
    @scroll.passive="onScroll"
  >
    <div :style="{ height: `${totalHeight}px`, position: 'relative' }">
      <div
        v-for="row in visible"
        :key="itemKey(row.item, row.index)"
        role="listitem"
        :aria-posinset="row.index + 1"
        :aria-setsize="items.length"
        :style="{ position: 'absolute', top: `${row.index * normalizedItemHeight}px`, height: `${normalizedItemHeight}px`, left: 0, right: 0 }"
      >
        <slot name="item" :item="row.item" :index="row.index" />
      </div>
    </div>
  </div>
</template>
