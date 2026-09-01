<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Смисловий колір. Кожен тон бере трійку токенів: текст / фон / межа. */
    tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
    /** Висота чипа. На мобільному кожен розмір вищий за десктопний. */
    size?: 'xs' | 'sm'
    /**
     * Робить чип інтерактивним: рендериться як `button`, отримує роль і
     * стає доступним із клавіатури.
     */
    clickable?: boolean
    /** Доступна назва. Потрібна, коли чип показує лише крапку чи іконку. */
    label?: string
    /** Значення нативного `title`. Потрібне, коли текст чипа обрізано. */
    title?: string
    /** Кольорова крапка замість іконки — компактний індикатор статусу. */
    dot?: boolean
    /**
     * Хрестик видалення праворуч. Сам чип не зникає — лише повідомляє
     * `remove`; список тримає батько (обрані фільтри, теги запису).
     */
    removable?: boolean
  }>(),
  { tone: 'neutral', size: 'xs' },
)

const emit = defineEmits<{
  /** Клік. Спрацьовує лише коли задано `clickable`. */
  click: [event: MouseEvent]
  /** Натиснуто хрестик `removable`. */
  remove: []
}>()

// Текст для доступної назви хрестика: «Видалити <текст чипа>».
const chipEl = ref<HTMLElement | null>(null)
const removeLabel = computed(() => {
  const text = props.label || chipEl.value?.textContent?.trim()
  return text ? `Видалити ${text}` : 'Видалити'
})

defineSlots<{
  /** Текст чипа. */
  default?: () => unknown
  /** Іконка перед текстом. Ігнорується, якщо задано `dot`. */
  icon?: () => unknown
}>()

const tones: Record<NonNullable<typeof props.tone>, string> = {
  accent: 'bg-primary-50 border-primary-200 text-accent',
  success: 'bg-success-bg border-success-line text-success',
  warning: 'bg-warning-bg border-warning-line text-warning',
  danger: 'bg-danger-bg border-danger-line text-danger',
  info: 'bg-info-bg border-info-line text-info',
  neutral: 'bg-neutral-bg border-neutral-line text-neutral',
}

const sizes: Record<NonNullable<typeof props.size>, string> = {
  xs: 'px-1.5 py-0.5 text-[10px] gap-1',
  sm: 'px-2 py-1 text-xs gap-1.5',
}

const classes = computed(() => [
  'inline-flex items-center rounded-full border font-medium leading-none whitespace-nowrap',
  tones[props.tone],
  sizes[props.size],
  // Наведення — напівпрозорий шар поточного КОЛЬОРУ ТЕКСТУ поверх тла, а не
  // brightness(0.95): затемнення в темній темі робить чип менш видимим, тоді
  // як шар currentColor контрастує з тлом в обох темах однаково.
  props.clickable
    ? 'cursor-pointer transition-shadow hover:shadow-[inset_0_0_0_100px_color-mix(in_oklab,currentColor_10%,transparent)] active:shadow-[inset_0_0_0_100px_color-mix(in_oklab,currentColor_16%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
    : '',
])
</script>

<template>
  <!--
    Семантичний тег обирається за інтерактивністю, а не за виглядом.
    Клікабельний чип мусить бути <button>: <div @click> недоступний із
    клавіатури й не має ролі для скрінрідера.
  -->
  <component
    :is="clickable ? 'button' : 'span'"
    ref="chipEl"
    :type="clickable ? 'button' : undefined"
    :class="classes"
    :aria-label="label"
    :title="title"
    @click="clickable && emit('click', $event)"
    @keydown.delete="clickable && removable && emit('remove')"
  >
    <span
      v-if="dot"
      class="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"
      aria-hidden="true"
    />
    <slot v-else name="icon" />
    <slot />
    <!-- Кнопка всередині чипа лише коли сам чип — span: <button> у <button>
         невалідний. Клікабельний чип із removable рендерить хрестик як
         span-іконку, а видалення лишається на клавіатурі через Delete. -->
    <component
      :is="clickable ? 'span' : 'button'"
      v-if="removable"
      :type="clickable ? undefined : 'button'"
      :aria-label="clickable ? undefined : removeLabel"
      :aria-hidden="clickable ? 'true' : undefined"
      class="-mr-1 flex h-4 w-4 items-center justify-center rounded-full opacity-70 transition-[opacity,background-color] hover:bg-current/15 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      @click.stop="emit('remove')"
    >
      <svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      </svg>
    </component>
  </component>
</template>
