<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Назва розкривного блоку. Слот title дозволяє доповнити її розміткою. */
    title: string
    /** Відкритий стан через v-model. Без нього компонент керує станом сам. */
    modelValue?: boolean
    /** Початково розкритий блок — лише в некерованому режимі. */
    defaultOpen?: boolean
    /** Заборонити перемикання заголовком. */
    disabled?: boolean
    /** Щільність заголовка та відступів вмісту. */
    size?: 'sm' | 'md'
    /** Тон заголовка; warning залишає зауваження помітними у згорнутому стані. */
    tone?: 'neutral' | 'warning'
  }>(),
  { modelValue: undefined, defaultOpen: false, disabled: false, size: 'md', tone: 'neutral' },
)

const emit = defineEmits<{
  'update:modelValue': [open: boolean]
}>()

defineSlots<{
  /** Вміст блоку. Зберігається змонтованим після згортання. */
  default: (props: { open: boolean }) => unknown
  /** Власний заголовок без вкладених кнопок або посилань. */
  title?: (props: { open: boolean }) => unknown
  /** Іконка ліворуч від заголовка. */
  leading?: (props: { open: boolean }) => unknown
  /** Лічильник або короткий статус праворуч, без інтерактивних елементів. */
  trailing?: (props: { open: boolean }) => unknown
}>()

const baseId = `${useId()}-expand`
const trigger = ref<HTMLButtonElement>()
const panel = ref<HTMLElement>()
const internalOpen = ref(props.defaultOpen)
const open = computed(() => props.modelValue ?? internalOpen.value)

function toggle() {
  if (props.disabled) return
  const next = !open.value
  if (props.modelValue === undefined) internalOpen.value = next
  emit('update:modelValue', next)
}

// External v-model changes may collapse a panel while a field inside has focus.
// Move focus before inert hides it from keyboard and assistive technology.
watch(open, (value) => {
  if (!value && typeof document !== 'undefined' && panel.value?.contains(document.activeElement)) {
    trigger.value?.focus()
  }
})
</script>

<template>
  <div class="min-w-0 rounded-control border border-line bg-card">
    <button
      :id="`${baseId}-trigger`"
      ref="trigger"
      type="button"
      :aria-expanded="open"
      :aria-controls="`${baseId}-panel`"
      :disabled="disabled"
      class="flex w-full min-w-0 items-center gap-2 rounded-control text-left font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-[44px]"
      :class="[
        size === 'sm' ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
        tone === 'warning' ? 'bg-warning-bg text-warning' : 'text-ink hover:bg-hover',
      ]"
      @click="toggle"
    >
      <span v-if="$slots.leading" class="flex shrink-0 items-center" aria-hidden="true">
        <slot name="leading" :open="open" />
      </span>
      <span class="min-w-0 flex-1 break-words">
        <slot name="title" :open="open">{{ title }}</slot>
      </span>
      <span v-if="$slots.trailing" class="flex shrink-0 items-center">
        <slot name="trailing" :open="open" />
      </span>
      <svg
        class="h-4 w-4 shrink-0 transition-transform duration-(--duration-slow) ease-emphasized motion-reduce:transition-none"
        :class="{ 'rotate-180': open }"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="m6 9 6 6 6-6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <div
      :id="`${baseId}-panel`"
      ref="panel"
      role="region"
      :aria-labelledby="`${baseId}-trigger`"
      :aria-hidden="!open"
      :inert="!open"
      class="grid transition-[grid-template-rows] duration-(--duration-slow) ease-emphasized motion-reduce:transition-none"
      :style="{ gridTemplateRows: open ? '1fr' : '0fr' }"
    >
      <div class="min-h-0 overflow-hidden">
        <div class="text-sm text-ink" :class="size === 'sm' ? 'p-3' : 'p-4'">
          <slot :open="open" />
        </div>
      </div>
    </div>
  </div>
</template>
