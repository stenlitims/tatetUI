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
  }>(),
  { src: undefined, name: undefined, size: 32, tone: 'primary' },
)

defineSlots<{
  /** Власний вміст замість картинки й ініціалів (іконка, логотип). */
  default?: () => unknown
}>()

const failed = ref(false)
// Нова URL — нова спроба: без цього старий стан помилки «липнув» до src.
watch(
  () => props.src,
  () => (failed.value = false),
)

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
  <span
    class="relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold uppercase"
    :class="toneClass"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="name ?? 'Аватар'"
  >
    <img
      v-if="src && !failed"
      :src="src"
      alt=""
      class="h-full w-full object-cover"
      @error="failed = true"
    />
    <slot v-else>
      <span v-if="initials" :class="fontSizeClass" aria-hidden="true">{{ initials }}</span>
    </slot>
  </span>
</template>