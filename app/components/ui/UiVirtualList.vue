<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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
  }>(),
  {
    height: '20rem',
    overscan: 5,
    keyField: 'id',
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

const visible = computed(() => {
  if (props.items.length === 0) return []
  const start = Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.overscan)
  const end = Math.min(
    props.items.length - 1,
    Math.ceil((scrollTop.value + clientHeight.value) / props.itemHeight) + props.overscan,
  )
  const rows: { item: T; index: number }[] = []
  for (let index = start; index <= end; index++) {
    const item = props.items[index]!
    rows.push({ item, index })
  }
  return rows
})

const totalHeight = computed(() => props.items.length * props.itemHeight)

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

onMounted(measure)

// Клієнтська висота відома лише в браузері; саме з неї рахується діапазон.
if (typeof document !== 'undefined') {
  window.addEventListener('resize', measure, { passive: true })
}

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    window.removeEventListener('resize', measure)
  }
})

// Зміна набору рядків чи висоти рядка зсовує діапазон — перечитуємо позицію.
watch([() => props.items, () => props.itemHeight], () => onScroll())

const itemKey = (item: T) => String(item[props.keyField] ?? '')
</script>

<template>
  <div
    ref="scrollEl"
    class="overflow-y-auto rounded-card border border-line bg-card"
    :style="{ height }"
    @scroll.passive="onScroll"
  >
    <div :style="{ height: `${totalHeight}px`, position: 'relative' }">
      <div
        v-for="row in visible"
        :key="itemKey(row.item)"
        :style="{ position: 'absolute', top: `${row.index * itemHeight}px`, height: `${itemHeight}px`, left: 0, right: 0 }"
      >
        <slot name="item" :item="row.item" :index="row.index" />
      </div>
    </div>
  </div>
</template>