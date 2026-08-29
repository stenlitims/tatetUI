<script setup lang="ts">
/**
 * Знак tatetUI для хрому сайту.
 *
 * Та сама геометрія, що в public/favicon.svg, але кольори — токенами, а не
 * hex: у статичному файлі змінних сторінки немає, а тут вони є, і знак
 * має жити за загальними правилами тем разом із рештою інтерфейсу.
 */
const props = withDefaults(
  defineProps<{
    /** Показувати текстову частину «tatetUI» поруч зі знаком. */
    withWordmark?: boolean
    /** Розмір знака. Текст масштабується разом із ним. */
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { withWordmark: true, size: 'md' },
)

type Size = NonNullable<typeof props.size>

const MARK_CLASSES: Record<Size, string> = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-9 w-9',
}

const WORDMARK_CLASSES: Record<Size, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
}

defineSlots<Record<string, never>>()
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <svg
      :class="MARK_CLASSES[size]"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="var(--accent-solid)" />
      <rect x="5.5" y="5.5" width="9" height="9" rx="2.5" fill="var(--accent-contrast)" />
      <rect x="17.5" y="5.5" width="9" height="9" rx="2.5" fill="var(--accent-contrast)" opacity="0.45" />
      <rect x="5.5" y="17.5" width="9" height="9" rx="2.5" fill="var(--accent-contrast)" opacity="0.45" />
      <rect x="17.5" y="17.5" width="9" height="9" rx="2.5" fill="var(--accent-contrast)" opacity="0.45" />
    </svg>
    <span
      v-if="withWordmark"
      :class="WORDMARK_CLASSES[size]"
      class="font-semibold tracking-tight text-ink"
    >tatetUI</span>
  </span>
</template>
