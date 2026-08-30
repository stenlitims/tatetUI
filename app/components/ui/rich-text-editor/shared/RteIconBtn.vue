<script setup lang="ts">
import RteIcon from './RteIcon.vue'
import type { RteIconName } from './icons'

/**
 * Кнопка тулбара.
 *
 * Стилі — утилітами Tailwind, а не власним класом `.rte-btn`, як в
 * оригіналі. Причина не стилістична: у SFC-блоці `<style>` правило
 * `color: var(--ink-muted)` переставало реагувати на зміну теми — колір
 * застигав на тому значенні, що діяло при першому обчисленні, тоді як
 * утиліта `text-muted` на тому самому елементі перемикалася коректно.
 *
 * Заразом це прибирає єдиний у бібліотеці острівець власних CSS-класів:
 * решта компонентів стилізується утилітами.
 *
 * Розміри `h-9 md:h-8` — щільність тулбара. Раніше було `h-11 md:h-8` з
 * посиланням на fieldSizes.sm, але поля на мобільному тепер 45px
 * (h-12), а тулбар не поле: кнопки мають лишатися компактними, зону
 * дотику пальцю дає невидима зона (W3C 2.5.8), а не заливка. У вихідному
 * проєкті було `h-7 sm:h-8`, тобто на мобільному МЕНШЕ — перевернуто
 * відносно правила дому, і обидва розміри нижче порога влучності пальця.
 */
withDefaults(
  defineProps<{
    icon: RteIconName
    /** Підпис для скрінрідера і нативної підказки. Обов'язковий. */
    title: string
    /** Кнопка відповідає активному стану під курсором. */
    active?: boolean
    disabled?: boolean
  }>(),
  {},
)

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

defineSlots<Record<string, never>>()
</script>

<template>
  <button
    type="button"
    class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8"
    :class="
      active
        ? 'bg-hover text-accent'
        : 'text-muted hover:bg-hover hover:text-ink disabled:hover:bg-transparent'
    "
    :title="title"
    :aria-label="title"
    :aria-pressed="active"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <RteIcon :name="icon" />
  </button>
</template>
