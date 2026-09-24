<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /**
     * Діаметр. `xs`/`sm` — усередині рядка тексту, кнопки чи комірки
     * таблиці; `md` — у картці; `lg` — на місці вмісту панелі.
     */
    size?: 'xs' | 'sm' | 'md' | 'lg'
    /**
     * Колір. `current` успадковує колір тексту батька — усередині суцільної
     * кнопки спінер сам стає білим, у приглушеному рядку — приглушеним.
     */
    tone?: 'current' | 'accent' | 'muted'
    /**
     * Що саме вантажиться: «Завантаження замовлень». Із ним спінер стає
     * `role="status"`; без нього — декоративний (`aria-hidden`), і стан
     * має оголошувати контейнер (`aria-busy`) або текст поруч.
     */
    label?: string
    /** Показати `label` видимим текстом праворуч від кола. */
    showLabel?: boolean
  }>(),
  { size: 'sm', tone: 'current', label: undefined, showLabel: false },
)

defineSlots<Record<string, never>>()

type Size = NonNullable<typeof props.size>
type Tone = NonNullable<typeof props.tone>

const SIZES: Record<Size, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
}

const TONES: Record<Tone, string> = {
  current: 'text-current',
  accent: 'text-accent',
  muted: 'text-muted',
}

const LABEL_SIZES: Record<Size, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-sm',
  lg: 'text-base',
}

const announced = computed(() => !!props.label)
</script>

<template>
  <!--
    role="status" — лише коли є що оголосити. Спінер без назви зі статусною
    роллю скрінрідер зачитує як «статус» і нічого більше: шум без змісту.
  -->
  <span
    class="inline-flex shrink-0 items-center gap-2 align-middle"
    :class="TONES[tone]"
    :role="announced ? 'status' : undefined"
    :aria-hidden="announced ? undefined : 'true'"
  >
    <!--
      pathLength="100" — довжини дуги задаються відсотками кола, а не
      2πr: однаковий рисунок за будь-якого розміру й товщини.
    -->
    <svg
      class="ui-spinner shrink-0"
      :class="SIZES[size]"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity="0.2" />
      <circle
        class="ui-spinner-arc"
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        pathLength="100"
        stroke-dasharray="30 100"
      />
    </svg>
    <span v-if="label" :class="showLabel ? ['text-muted', LABEL_SIZES[size]] : 'sr-only'">{{ label }}</span>
  </span>
</template>

<style scoped>
/*
 * Обертається вся SVG, а не дуга: transform на <circle> у Safari рахує
 * origin від вьюпорта SVG, і дуга «гуляла» б по колу замість обертання.
 */
.ui-spinner {
  animation: ui-spinner-rotate 0.8s linear infinite;
}

@keyframes ui-spinner-rotate {
  to {
    transform: rotate(1turn);
  }
}

/*
 * Під reduced-motion обертання зупиняє глобальний вимикач у main.css —
 * так само, як у Progress і LoadingDots. Щоб застигле коло все одно
 * читалося як «вантажиться», а не як іконка, дуга стає довшою: три чверті
 * кола — впізнаваний статичний гліф очікування.
 */
@media (prefers-reduced-motion: reduce) {
  .ui-spinner-arc {
    stroke-dasharray: 75 100;
  }
}
</style>
