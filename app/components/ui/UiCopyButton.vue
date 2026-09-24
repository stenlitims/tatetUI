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
    /**
     * Висота кнопки — та сама шкала, що в UiButton: на мобільному `sm` 9,
     * `md` 10, з `md:` 8 і 9 (rem за кореня 15px).
     */
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

/*
 * Розміри — ті самі, що в UiButton `sm`/`md`. Раніше копіювання мало h-8
 * на мобільному й h-8 на десктопі з дрібнішим шрифтом, і в одному тулбарі
 * з UiButton того ж `size` стояло нижчим за сусідку.
 */
const SIZES: Record<NonNullable<typeof props.size>, string> = {
  sm: 'h-9 px-3 text-base md:h-8 md:px-2.5 md:text-xs',
  md: 'h-10 px-4 text-base md:h-9 md:px-3.5 md:text-sm',
}

const classes = computed(() => [
  // active: і ring-offset — як у UiButton. На дотику :hover не настає, і без
  // стану натискання кнопка не давала жодного відгуку до самого
  // «Скопійовано»; без offset кільце зливалося з outline-рамкою.
  'relative inline-flex select-none items-center justify-center gap-1.5 rounded-control font-medium transition-[color,background-color,border-color,box-shadow,transform] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset',
  // Невидима зона 45×45 на дотику — той самий патерн, що в UiButton:
  // сама кнопка лишається компактною, як у полі чи тулбарі поруч.
  'pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-[\'\'] pointer-coarse:after:h-12 pointer-coarse:after:w-12',
  props.variant === 'outline'
    ? 'border border-line bg-card text-ink hover:bg-hover active:bg-hover'
    : 'text-muted hover:bg-hover hover:text-ink active:bg-hover active:text-ink',
  SIZES[props.size],
  props.label ? '' : 'aspect-square',
  state.value === 'copied' ? 'text-success' : '',
  state.value === 'failed' ? 'text-danger' : '',
])

/*
 * Текст для живої області. Область існує ЗАВЖДИ, змінюється лише її
 * вміст: раніше role="status" вставлявся через v-if разом зі своїм
 * текстом, а таку область скрінрідери здебільшого пропускають — іконкова
 * кнопка копіювала мовчки.
 */
const announcement = computed(() => {
  if (state.value === 'copied') return props.copiedLabel
  if (state.value === 'failed') return 'Не вдалося скопіювати'
  return ''
})
</script>

<template>
  <button type="button" :class="classes" :aria-label="ariaLabel" :title="ariaLabel" @click="copy">
    <!-- Індикатор позиційований абсолютно: кнопка не стрибає в ширині,
         коли підпис змінюється на «Скопійовано» (той самий патерн, що в
         UiButton під час loading). Він лише візуальний — озвучує стан
         жива область нижче. Слово — лише в кнопки з підписом: у квадратній
         іконковій «Скопійовано» не вміщалось і вилазило за її межі. -->
    <span
      v-if="state !== 'idle'"
      class="absolute inset-0 flex items-center justify-center gap-1.5 px-2.5"
      aria-hidden="true"
    >
      <svg v-if="state === 'copied'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <svg v-else class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
        <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <span v-if="label">{{ state === 'copied' ? copiedLabel : 'Помилка' }}</span>
    </span>

    <span
      class="sr-only"
      role="status"
      :aria-live="state === 'failed' ? 'assertive' : 'polite'"
    >{{ announcement }}</span>

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
