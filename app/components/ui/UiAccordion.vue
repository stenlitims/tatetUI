<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, ref, useId, watch } from 'vue'

export interface AccordionItem {
  id: string
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    /** Секції акордеона. */
    items: AccordionItem[]
    /**
     * Відкриті секції. Використовуйте через `v-model`. Без `v-model`
     * компонент керує станом сам, починаючи з `defaultOpen`.
     */
    modelValue?: string[]
    /** Початково відкриті id — лише в некерованому режимі. */
    defaultOpen?: string[]
    /** Показувати шеврон праворуч. */
    showToggle?: boolean
    /**
     * Лише одна відкрита секція: відкриття наступної закриває попередню.
     * Для FAQ і майстрів налаштувань, де секції взаємовиключні.
     */
    single?: boolean
    /**
     * Рівень заголовків секцій. Має продовжувати структуру сторінки:
     * акордеон під `h2` — це `3`, у модалці з заголовком `h2` — теж `3`,
     * у секції з `h3` — `4`. Інакше скрінрідер будує хибний зміст.
     */
    headingLevel?: 2 | 3 | 4 | 5 | 6
  }>(),
  { modelValue: undefined, defaultOpen: () => [], showToggle: true, single: false, headingLevel: 3 },
)

const emit = defineEmits<{
  /** Набір відкритих секцій змінився. Використовуйте через `v-model`. */
  'update:modelValue': [ids: string[]]
  /** Секцію відкрито. */
  open: [id: string]
  /** Секцію закрито. */
  close: [id: string]
}>()

defineSlots<{
  /** Вміст секції з цим id. */
  [key: `content-${string}`]: () => unknown
  /** Власний рендер заголовка секції. */
  label?: (props: { item: AccordionItem; open: boolean }) => unknown
}>()

const generatedId = useId()
const baseId = `${generatedId}-acc`

/*
 * Елементи — у мапах за id, а не в масиві за індексом: масив template-ref
 * після видалення секції з середини отримував null на місці сусіда, і
 * стрілка туди мовчки не переводила фокус.
 */
const headerEls = new Map<string, HTMLElement>()
const panelEls = new Map<string, HTMLElement>()

function setElement(map: Map<string, HTMLElement>, id: string, value: Element | ComponentPublicInstance | null) {
  if (value instanceof HTMLElement) map.set(id, value)
  else map.delete(id)
}

/*
 * Некерований режим: modelValue не задано → стан живе тут. Керований:
 * стан приходить ЛИШЕ згори. Раніше тоггл писав внутрішній стан і в
 * керованому режимі — батько, що відхилив зміну, бачив відкриту секцію,
 * якої немає в його modelValue.
 */
const internalOpen = ref<string[]>([...(props.modelValue ?? props.defaultOpen)])
const openIds = computed(() => props.modelValue ?? internalOpen.value)

watch(
  () => props.modelValue,
  (value) => {
    // Якщо v-model згодом приберуть, некерований стан продовжить з останнього.
    if (value != null) internalOpen.value = [...value]
  },
)

const isOpen = (id: string) => openIds.value.includes(id)

/*
 * Секцію, у якій стоїть фокус, закрили згори (v-model, single-режим з
 * коду) — повертаємо фокус на її заголовок ДО того, як inert прибере
 * панель: інакше фокус падав у <body> і клавіатурний користувач
 * починав обхід сторінки спочатку. Той самий захист, що в UiExpand.
 */
watch(openIds, (next, previous) => {
  if (typeof document === 'undefined') return
  for (const id of previous) {
    if (next.includes(id)) continue
    if (panelEls.get(id)?.contains(document.activeElement)) headerEls.get(id)?.focus()
  }
})

function toggle(item: AccordionItem) {
  if (item.disabled) return
  const open = !isOpen(item.id)
  const next = open
    ? props.single
      ? [item.id]
      : [...openIds.value, item.id]
    : openIds.value.filter((id) => id !== item.id)
  if (props.modelValue === undefined) internalOpen.value = next
  emit('update:modelValue', [...next])
  if (open) emit('open', item.id)
  else emit('close', item.id)
}

/*
 * Навігація між заголовками: ↑/↓ — попередній/наступний, Home/End —
 * перший/останній. Нативна disabled-кнопка не може отримати фокус, тому
 * навігація пропускає вимкнені секції та циклічно обходить лише доступні.
 */
function onHeaderKeydown(event: KeyboardEvent, index: number) {
  const enabled = props.items
    .map((item, itemIndex) => ({ item, index: itemIndex }))
    .filter(({ item }) => !item.disabled)
  if (!enabled.length) return
  const current = enabled.findIndex((entry) => entry.index === index)

  const go = (target: number) => {
    event.preventDefault()
    const id = enabled[target]?.item.id
    if (id) void nextTick(() => headerEls.get(id)?.focus())
  }

  if (event.key === 'ArrowDown') {
    go((current + 1 + enabled.length) % enabled.length)
  } else if (event.key === 'ArrowUp') {
    go((current - 1 + enabled.length) % enabled.length)
  } else if (event.key === 'Home') {
    go(0)
  } else if (event.key === 'End') {
    go(enabled.length - 1)
  }
}
</script>

<template>
  <div class="divide-y divide-line rounded-card border border-line bg-card">
    <div v-for="(item, index) in items" :key="item.id">
      <component :is="`h${headingLevel}`" class="m-0">
        <!-- pointer-coarse:min-h-[44px] — як у UiExpand: py-3 з text-sm дає
             лише 41px, нижче мінімальної цілі для пальця. -->
        <button
          :id="`${baseId}-${item.id}-button`"
          :ref="(el) => setElement(headerEls, item.id, el)"
          :aria-expanded="isOpen(item.id)"
          :aria-controls="`${baseId}-${item.id}-panel`"
          :disabled="item.disabled"
          class="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-[44px]"
          :class="item.disabled ? 'text-muted' : 'text-ink hover:bg-hover'"
          @click="toggle(item)"
          @keydown="onHeaderKeydown($event, index)"
        >
          <slot name="label" :item="item" :open="isOpen(item.id)">{{ item.label }}</slot>
          <!-- Шеврон обертається рівно стільки, скільки розкривається панель:
               з типовими 180 мс він «приїжджав» раніше за вміст. -->
          <svg
            v-if="showToggle"
            class="h-4 w-4 shrink-0 text-muted transition-[transform,color] duration-(--duration-slow) ease-emphasized group-hover:text-ink"
            :class="isOpen(item.id) ? 'rotate-180 text-accent' : ''"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </component>
      <!-- Анімація висоти через grid-рядки 0fr→1fr: без JS-вимірювань
           і без жорсткої max-height; глобальний reduced-motion вимикач
           зупиняє transition сам. -->
      <div
        :id="`${baseId}-${item.id}-panel`"
        :ref="(el) => setElement(panelEls, item.id, el)"
        role="region"
        :aria-labelledby="`${baseId}-${item.id}-button`"
        :aria-hidden="!isOpen(item.id)"
        :inert="!isOpen(item.id)"
        class="grid transition-[grid-template-rows] duration-(--duration-slow) ease-emphasized"
        :style="{ gridTemplateRows: isOpen(item.id) ? '1fr' : '0fr' }"
      >
        <div class="overflow-hidden">
          <div class="px-4 pb-4 text-sm text-muted">
            <slot :name="`content-${item.id}`" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
