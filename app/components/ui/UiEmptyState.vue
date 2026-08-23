<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Головний рядок. Формулюйте як стан, а не як помилку. */
    title: string
    /** Пояснення під заголовком. Найкраще — що зробити далі. */
    description?: string
    tone?: 'neutral' | 'accent' | 'danger'
    /** Щільний варіант — для порожньої таблиці чи панелі, а не сторінки. */
    compact?: boolean
  }>(),
  { tone: 'neutral' },
)

defineSlots<{
  /** Дія — зазвичай одна кнопка, що усуває причину порожнечі. */
  default?: () => unknown
  /** Іконка над заголовком. */
  icon?: () => unknown
}>()

const iconTones: Record<NonNullable<typeof props.tone>, string> = {
  neutral: 'bg-neutral-bg text-neutral',
  accent: 'bg-primary-50 text-accent',
  danger: 'bg-danger-bg text-danger',
}

const iconClasses = computed(() => iconTones[props.tone])
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-center"
    :class="compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14'"
  >
    <div
      v-if="$slots.icon"
      class="flex items-center justify-center rounded-full"
      :class="[iconClasses, compact ? 'h-9 w-9 text-sm' : 'h-12 w-12 text-lg']"
    >
      <slot name="icon" />
    </div>
    <p class="font-medium text-ink" :class="compact ? 'text-sm' : 'text-base'">
      {{ title }}
    </p>
    <p v-if="description" class="max-w-sm text-xs leading-relaxed text-muted">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-1">
      <slot />
    </div>
  </div>
</template>
