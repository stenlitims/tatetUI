<script setup lang="ts">
/**
 * Роздільник.
 *
 * Правило, заради якого існує props `decorative`:
 *
 * - Лінія лише МАЛЮЄ межу, яку розмітка вже виражає (між `<li>`, між
 *   секціями картки, між групами тулбара) → `aria-hidden`, без ролі.
 * - Лінія Є єдиним носієм межі (між незв'язаними секціями меню, «або» між
 *   способами входу) → `role="separator"`.
 *
 * Помилка дорога в обидва боки: у першому випадку скрінрідер зачитає сотню
 * порожніх роздільників, у другому — не помітить межі взагалі.
 */
import { computed, useSlots } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Напрям лінії. Вертикальна вимагає, щоб батько був flex-рядком. */
    orientation?: 'horizontal' | 'vertical'
    /**
     * Текст посередині лінії: «або», «Архів». Наявність підпису САМА
     * робить роздільник смисловим, тож `decorative` при ньому ігнорується.
     */
    label?: string
    /** Де стоїть підпис уздовж лінії. */
    labelPosition?: 'start' | 'center' | 'end'
    /**
     * `true` — межа вже виражена розміткою навколо, лінія лише декор.
     * `false` — межа існує ЛИШЕ як ця лінія.
     */
    decorative?: boolean
    /** Зовнішні відступи навколо лінії. */
    spacing?: 'none' | 'sm' | 'md'
  }>(),
  {
    orientation: 'horizontal',
    labelPosition: 'center',
    decorative: true,
    spacing: 'md',
  },
)

type Orientation = NonNullable<typeof props.orientation>
type Spacing = NonNullable<typeof props.spacing>

defineSlots<{
  /**
   * Власний підпис замість `label`. `label` при цьому лишається потрібним:
   * роль `separator` не бере назву з вмісту, тож `aria-label` береться саме
   * з нього.
   */
  default?: () => unknown
}>()

const SPACING: Record<Orientation, Record<Spacing, string>> = {
  horizontal: { none: '', sm: 'my-2', md: 'my-4' },
  vertical: { none: '', sm: 'mx-2', md: 'mx-4' },
}

/*
 * Позицію підпису задає ДОВЖИНА ліній, а не justify-*. Раніше обидві лінії
 * були flex-1 і забирали весь вільний простір порівну, тож justify-start
 * і justify-end не мали чого розподіляти: підпис стояв по центру за
 * будь-якого labelPosition (виміряно в Chromium — той самий x для start і
 * end). Тепер лінія з боку позиції — короткий фіксований відрізок.
 *
 * Вертикальний підписаний роздільник — колонка: лінії згори й знизу, текст
 * посередині. Раніше він малював горизонтальні лінії з
 * aria-orientation="vertical" — «або» між двома формами поруч лягав
 * смужкою впоперек.
 */
function lineClass(side: 'leading' | 'trailing'): string {
  const short =
    (side === 'leading' && props.labelPosition === 'start') ||
    (side === 'trailing' && props.labelPosition === 'end')
  if (props.orientation === 'vertical') return short ? 'h-3 w-px shrink-0' : 'min-h-3 w-px flex-1'
  return short ? 'h-px w-4 shrink-0' : 'h-px flex-1'
}

// defineSlots дає лише типи, тож наявність слота в рантаймі читається
// через useSlots — викликати defineSlots двічі не можна.
const slots = useSlots()

const hasLabel = computed(() => !!props.label || !!slots.default)
// Підпис робить роздільник смисловим за визначенням.
const isSemantic = computed(() => hasLabel.value || !props.decorative)
</script>

<template>
  <div
    v-if="hasLabel"
    :role="isSemantic ? 'separator' : undefined"
    :aria-orientation="isSemantic ? orientation : undefined"
    :aria-label="isSemantic ? label : undefined"
    :aria-hidden="isSemantic ? undefined : 'true'"
    class="flex items-center"
    :class="[
      SPACING[orientation][spacing],
      orientation === 'vertical' ? 'shrink-0 flex-col gap-2 self-stretch' : 'gap-3',
    ]"
  >
    <span class="bg-line" :class="lineClass('leading')" />
    <!-- Текст прихований від скрінрідера: ім'я роль separator бере з
         aria-label, а не з вмісту, і без aria-hidden воно прозвучало б двічі. -->
    <span class="shrink-0 text-xs font-medium uppercase tracking-wide text-muted" aria-hidden="true">
      <slot>{{ label }}</slot>
    </span>
    <span class="bg-line" :class="lineClass('trailing')" />
  </div>

  <div
    v-else
    :role="isSemantic ? 'separator' : undefined"
    :aria-orientation="isSemantic ? orientation : undefined"
    :aria-hidden="isSemantic ? undefined : 'true'"
    class="shrink-0 bg-line"
    :class="[
      SPACING[orientation][spacing],
      orientation === 'horizontal' ? 'h-px w-full' : 'w-px self-stretch min-h-4',
    ]"
  />
</template>
