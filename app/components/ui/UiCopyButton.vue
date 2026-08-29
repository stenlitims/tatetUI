<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

/**
 * Резервне копіювання через прихований textarea: navigator.clipboard
 * існує не скрізь (немає на http, кидає NotAllowedError поза фокусом
 * документа). Той самий патерн, що в ComponentPreview.
 */
function copyLegacy(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(area)
  return ok
}

const props = withDefaults(
  defineProps<{
    /** Що копіювати. */
    text: string
    /** Підпис у спокійному стані. Порожньо — квадратна кнопка з іконкою. */
    label?: string
    /** Підпис після успішного копіювання. */
    copiedLabel?: string
    /** Візуальна вага. */
    variant?: 'ghost' | 'outline'
    /** Висота кнопки. На мобільному кожен розмір вищий за десктопний. */
    size?: 'sm' | 'md'
    /** Доступна назва. Обов'язкова, коли `label` не задано. */
    ariaLabel?: string
  }>(),
  {
    label: '',
    copiedLabel: 'Скопійовано',
    variant: 'ghost',
    size: 'sm',
    ariaLabel: undefined,
  },
)

const emit = defineEmits<{
  /** Копіювання вдалося. */
  copied: [text: string]
  /** Копіювання не вдалося (рідкісний випадок — обидва шляхи провалились). */
  failed: []
}>()

defineSlots<{
  /** Іконка замість стандартної. */
  icon?: () => unknown
}>()

const state = ref<'idle' | 'copied' | 'failed'>('idle')
let timer: ReturnType<typeof setTimeout> | undefined

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  timer = undefined
})

// Новий text — новий стан: без цього «Скопійовано» липне до нової кнопки.
watch(
  () => props.text,
  () => {
    if (timer) clearTimeout(timer)
    timer = undefined
    state.value = 'idle'
  },
)

async function copy() {
  let ok = false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(props.text)
      ok = true
    }
  } catch {
    ok = false
  }
  if (!ok && typeof document !== 'undefined') ok = copyLegacy(props.text)

  state.value = ok ? 'copied' : 'failed'
  if (ok) emit('copied', props.text)
  else emit('failed')

  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    state.value = 'idle'
    timer = undefined
  }, 2000)
}

const classes = computed(() => [
  'relative inline-flex select-none items-center justify-center gap-1.5 rounded-control font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  props.variant === 'outline'
    ? 'border border-line bg-card text-ink hover:bg-hover'
    : 'text-muted hover:bg-hover hover:text-ink',
  props.size === 'sm' ? 'h-11 px-2.5 text-xs md:h-8' : 'h-11 px-3 text-sm md:h-9',
  props.label ? '' : 'aspect-square',
  state.value === 'copied' ? 'text-success' : '',
  state.value === 'failed' ? 'text-danger' : '',
])
</script>

<template>
  <button type="button" :class="classes" :aria-label="ariaLabel" :title="ariaLabel" @click="copy">
    <!-- Індикатор позиційований абсолютно: кнопка не стрибає в ширині,
         коли підпис змінюється на «Скопійовано» (той самий патерн, що в
         UiButton під час loading). -->
    <span
      v-if="state !== 'idle'"
      :role="state === 'failed' ? 'alert' : 'status'"
      :aria-live="state === 'failed' ? 'assertive' : 'polite'"
      class="absolute inset-0 flex items-center justify-center gap-1.5 px-2.5"
    >
      <svg v-if="state === 'copied'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <svg v-else class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
        <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <span>{{ state === 'copied' ? copiedLabel : 'Помилка' }}</span>
    </span>

    <span class="inline-flex items-center gap-1.5" :class="state !== 'idle' ? 'opacity-0' : ''">
      <slot name="icon">
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2" />
          <path
            d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
            stroke="currentColor"
            stroke-width="2"
          />
        </svg>
      </slot>
      <span v-if="label">{{ label }}</span>
    </span>
  </button>
</template>
