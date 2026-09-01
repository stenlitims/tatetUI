<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** URL зображення. Помилка завантаження мовчки падає на ініціали. */
    src?: string
    /** Ім'я людини: джерело ініціалів і доступна назва. */
    name?: string
    /** Розмір у пікселях. */
    size?: number
    /** Палітра заливки, коли картинки немає. */
    tone?: 'primary' | 'neutral'
    /**
     * Індикатор присутності у правому нижньому куті. Колір дублюється
     * словом у доступній назві: «Марія, онлайн».
     */
    status?: 'online' | 'offline' | 'busy' | 'away'
  }>(),
  { src: undefined, name: undefined, size: 32, tone: 'primary', status: undefined },
)

const STATUS: Record<NonNullable<typeof props.status>, { dot: string; label: string }> = {
  online: { dot: 'bg-success', label: 'онлайн' },
  offline: { dot: 'bg-line-strong', label: 'офлайн' },
  busy: { dot: 'bg-danger', label: 'зайнятий' },
  away: { dot: 'bg-warning', label: 'відійшов' },
}

const accessibleName = computed(() => {
  const base = props.name ?? 'Аватар'
  return props.status ? `${base}, ${STATUS[props.status].label}` : base
})

// Крапка масштабується з аватаром: 28% діаметра, не менше 8px.
const statusSize = computed(() => Math.max(8, Math.round(props.size * 0.28)))

defineSlots<{
  /** Власний вміст замість картинки й ініціалів (іконка, логотип). */
  default?: () => unknown
}>()

const failed = ref(false)
const loaded = ref(false)
// Нова URL — нова спроба: без цього старий стан помилки «липнув» до src.
watch(
  () => props.src,
  () => {
    failed.value = false
    loaded.value = false
  },
)

// Картинка з кешу вже complete на момент монтування — події load не буде.
function onImageRef(el: unknown) {
  if (el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0) loaded.value = true
}

const initials = computed(() => {
  const parts = (props.name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
})

const toneClass = computed(() =>
  props.tone === 'neutral'
    ? 'border border-neutral-line bg-neutral-bg text-neutral'
    : 'bg-gradient-to-br from-primary-400 to-primary-600 text-accent-contrast',
)

const fontSizeClass = computed(() =>
  props.size >= 40 ? 'text-sm' : props.size >= 24 ? 'text-xs' : 'text-[10px]',
)
</script>

<template>
  <!-- Обрізання — на внутрішньому колі, а не на корені: індикатор статусу
       виходить за межі кола і не має обрізатись. -->
  <span
    class="relative inline-flex shrink-0 select-none"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="accessibleName"
  >
  <span
    class="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full font-semibold uppercase"
    :class="toneClass"
  >
    <!-- Ініціали під картинкою до завантаження: аватар ніколи не порожній,
         а картинка проявляється поверх, а не вмикається стрибком. -->
    <span
      v-if="src && !failed && !loaded && initials && !$slots.default"
      :class="fontSizeClass"
      aria-hidden="true"
    >{{ initials }}</span>
    <img
      v-if="src && !failed"
      :ref="onImageRef"
      :src="src"
      alt=""
      loading="lazy"
      decoding="async"
      class="absolute inset-0 h-full w-full object-cover transition-opacity"
      :class="loaded ? 'opacity-100' : 'opacity-0'"
      @load="loaded = true"
      @error="failed = true"
    />
    <slot v-if="!src || failed">
      <span v-if="initials" :class="fontSizeClass" aria-hidden="true">{{ initials }}</span>
    </slot>
  </span>
  <span
    v-if="status"
    aria-hidden="true"
    class="absolute right-0 bottom-0 rounded-full ring-2 ring-card"
    :class="STATUS[status].dot"
    :style="{ width: `${statusSize}px`, height: `${statusSize}px` }"
  />
  </span>
</template>