<script setup lang="ts">
import { nextTick, onBeforeUpdate, ref, useId, watch } from 'vue'

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
  }>(),
  { modelValue: undefined, defaultOpen: () => [], showToggle: true },
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

const headerButtonEls = ref<(HTMLElement | null)[]>([])

// Template-refs у v-for накопичуються між рендерами: без скидання масив
// тримав би хибні елементи після зміни набору секцій (той самий патерн,
// що в UiTabs і UiSelect).
onBeforeUpdate(() => {
  headerButtonEls.value = []
})

/*
 * Некерований режим: modelValue не задано → стан живе тут. Керований:
 * кожен тоггл емітовиться, стан приходить згори.
 */
const internalOpen = ref<string[]>([...(props.modelValue ?? props.defaultOpen)])

watch(
  () => props.modelValue,
  (value) => {
    if (value != null) internalOpen.value = [...value]
  },
)

const isOpen = (id: string) => internalOpen.value.includes(id)

function toggle(item: AccordionItem) {
  if (item.disabled) return
  const open = !isOpen(item.id)
  internalOpen.value = open
    ? [...internalOpen.value, item.id]
    : internalOpen.value.filter((id) => id !== item.id)
  emit('update:modelValue', [...internalOpen.value])
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
    void nextTick(() => headerButtonEls.value[enabled[target]?.index ?? 0]?.focus())
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
      <h3 class="m-0">
        <button
          :id="`${baseId}-${item.id}-button`"
          :ref="(el) => (headerButtonEls[index] = el as HTMLElement)"
          :aria-expanded="isOpen(item.id)"
          :aria-controls="`${baseId}-${item.id}-panel`"
          :disabled="item.disabled"
          class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          :class="item.disabled ? 'text-muted' : 'text-ink hover:bg-hover'"
          @click="toggle(item)"
          @keydown="onHeaderKeydown($event, index)"
        >
          <slot name="label" :item="item" :open="isOpen(item.id)">{{ item.label }}</slot>
          <svg
            v-if="showToggle"
            class="h-4 w-4 shrink-0 text-muted transition-transform duration-200"
            :class="isOpen(item.id) ? 'rotate-180' : ''"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </h3>
      <!-- Анімація висоти через grid-рядки 0fr→1fr: без JS-вимірювань
           і без жорсткої max-height; глобальний reduced-motion вимикач
           зупиняє transition сам. -->
      <div
        :id="`${baseId}-${item.id}-panel`"
        role="region"
        :aria-labelledby="`${baseId}-${item.id}-button`"
        :aria-hidden="!isOpen(item.id)"
        :inert="!isOpen(item.id)"
        class="grid transition-[grid-template-rows] duration-200 ease-out"
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
