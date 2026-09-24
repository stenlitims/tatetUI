<script setup lang="ts">
import { Comment, computed, useSlots, type VNode } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Смисловий колір. Кожен тон бере трійку токенів: текст / фон / межа. */
    tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
    /**
     * Висота чипа: `xs` — щільні таблиці й списки, `sm` — фільтри й теги
     * поруч із полями. На дотику клікабельний чип і хрестик добирають
     * невидиму зону влучання — сама висота від цього не росте.
     */
    size?: 'xs' | 'sm'
    /**
     * Робить чип інтерактивним: рендериться як `button`, отримує роль і
     * стає доступним із клавіатури.
     */
    clickable?: boolean
    /**
     * Доступна назва. Потрібна, коли чип показує лише крапку чи іконку.
     * Заміняє видимий текст для скрінрідера, як `aria-label`.
     */
    label?: string
    /**
     * Значення нативного `title`. Довгий текст обрізається трикрапкою по
     * ширині батька — тоді `title` показує його повністю.
     */
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

defineSlots<{
  /** Текст чипа. */
  default?: () => unknown
  /** Іконка перед текстом. Ігнорується, якщо задано `dot`. */
  icon?: () => unknown
}>()

const slots = useSlots()

function textOf(nodes: VNode[] | undefined): string {
  let text = ''
  for (const node of nodes ?? []) {
    // Коментар — це плейсхолдер v-if, а не текст чипа.
    if (node.type === Comment) continue
    if (typeof node.children === 'string') text += node.children
    else if (Array.isArray(node.children)) text += textOf(node.children as VNode[])
  }
  return text
}

/*
 * Назва хрестика «Видалити <текст чипа>» — з VNode слота під час рендера,
 * а не з textContent після монтування. textContent читався один раз і не
 * був реактивним: чип, перевикористаний під інше значення, лишався з
 * хрестиком «Видалити Київ» на написі «Львів», а на сервері назва була
 * голим «Видалити».
 */
function removeLabel(): string {
  const text = props.label || textOf(slots.default?.() as VNode[] | undefined).replace(/\s+/g, ' ').trim()
  return text ? `Видалити ${text}` : 'Видалити'
}

/*
 * Невидима зона влучання на дотику: 45px завширшки, але лише 30px заввишки.
 * Повні 45 по висоті переходили б на наступний ряд чипів (між рядами
 * 7.5px), і позиціонована зона, намальована поверх їхнього тексту, забирала
 * б дотик — палець видаляв би СУСІДНІЙ фільтр. 45×30 — з запасом більше за
 * 24×24 WCAG 2.5.8 і не дістає до сусідів.
 */
const TOUCH_ZONE =
  'pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 ' +
  'pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 ' +
  "pointer-coarse:after:content-[''] pointer-coarse:after:h-8"

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
  // max-w-full: довгий тег не розпирає комірку таблиці чи картку — текст
  // усередині обрізається трикрапкою, а не вилазить за межу батька.
  'inline-flex max-w-full items-center rounded-full border font-medium leading-none whitespace-nowrap',
  tones[props.tone],
  sizes[props.size],
  // Наведення — напівпрозорий шар поточного КОЛЬОРУ ТЕКСТУ поверх тла, а не
  // brightness(0.95): затемнення в темній темі робить чип менш видимим, тоді
  // як шар currentColor контрастує з тлом в обох темах однаково.
  // isolate тримає z-10 хрестика всередині чипа, а не на всю сторінку.
  props.clickable
    ? `relative isolate cursor-pointer transition-shadow hover:shadow-[inset_0_0_0_100px_color-mix(in_oklab,currentColor_10%,transparent)] active:shadow-[inset_0_0_0_100px_color-mix(in_oklab,currentColor_16%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${TOUCH_ZONE} pointer-coarse:after:w-full pointer-coarse:after:min-w-12`
    : '',
])

/*
 * У клікабельному чипі хрестик лежить ПОВЕРХ зони влучання самого чипа
 * (z-10): інакше ::after чипа забирав би дотик і на хрестику, і пальцем
 * видалити фільтр стало б неможливо — лише клавішею Delete.
 */
const removeClass = computed(() =>
  props.clickable ? `z-10 ${TOUCH_ZONE} pointer-coarse:after:w-8` : `${TOUCH_ZONE} pointer-coarse:after:w-12`,
)
</script>

<template>
  <!--
    Семантичний тег обирається за інтерактивністю, а не за виглядом.
    Клікабельний чип мусить бути <button>: <div @click> недоступний із
    клавіатури й не має ролі для скрінрідера.
  -->
  <component
    :is="clickable ? 'button' : 'span'"
    :type="clickable ? 'button' : undefined"
    :class="classes"
    :aria-label="clickable ? label : undefined"
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
    <!--
      Текст — в окремому елементі з min-w-0: текст прямо у flex-контейнері
      стає анонімним елементом без overflow, і обрізати його нема чим.
      overflow-x-clip, а не truncate: truncate ховає й вертикальне
      переповнення, а з leading-none це зрізало б виносні «р», «у», «д».
    -->
    <span
      v-if="$slots.default"
      class="min-w-0 overflow-x-clip text-ellipsis"
      :aria-hidden="!clickable && label ? 'true' : undefined"
    ><slot /></span>
    <!--
      aria-label на <span> без ролі заборонений (ARIA 1.2, роль generic):
      NVDA і JAWS його не читають, тож «крапка без тексту + label» лишалась
      німою. Прихований текст читається всюди; видимий тоді ховається, щоб
      не прозвучати двічі, — та сама семантика, що в aria-label кнопки.
    -->
    <span v-if="!clickable && label" class="sr-only">{{ label }}</span>
    <!-- Кнопка всередині чипа лише коли сам чип — span: <button> у <button>
         невалідний. Клікабельний чип із removable рендерить хрестик як
         span-іконку, а видалення лишається на клавіатурі через Delete. -->
    <component
      :is="clickable ? 'span' : 'button'"
      v-if="removable"
      :type="clickable ? undefined : 'button'"
      :aria-label="clickable ? undefined : removeLabel()"
      :aria-hidden="clickable ? 'true' : undefined"
      class="relative -mr-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full opacity-70 transition-[opacity,background-color] hover:bg-current/15 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      :class="removeClass"
      @click.stop="emit('remove')"
    >
      <svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      </svg>
    </component>
  </component>
</template>
