<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /**
     * Число на значку. `null` чи `0` ховають значок (див. `showZero`), тож
     * батькові не треба обгортати компонент у `v-if`.
     */
    count?: number | null
    /** Більші числа друкуються як «99+»: значок не розростається на пів іконки. */
    max?: number
    /** Крапка без числа — «є щось нове», кількість неважлива. */
    dot?: boolean
    /** Показувати значок і тоді, коли `count` дорівнює 0. */
    showZero?: boolean
    /**
     * Колір значка. `danger` — непрочитане, що чекає дії; `accent` — нове,
     * але не термінове; `success`/`warning` — статус присутності чи стану.
     */
    tone?: 'danger' | 'accent' | 'success' | 'warning' | 'neutral'
    /** Кут, до якого кріпиться значок. */
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
    /**
     * Кругла ціль (аватар, кругла кнопка): значок зсувається до кола, а не
     * до кута квадрата, інакше він висить у повітрі поруч.
     */
    circular?: boolean
    /**
     * Хвиля навколо значка — привертає увагу до щойно прийнятої події.
     * Вимикайте, щойно користувач її побачив: безперервний рух на краю
     * зору заважає читати все інше.
     */
    pulse?: boolean
    /**
     * Текст для скрінрідера: «3 непрочитаних». Типово значок `aria-hidden`
     * і число має бути в назві самої кнопки — див. розділ «Доступність».
     */
    label?: string
  }>(),
  {
    count: null,
    max: 99,
    dot: false,
    showZero: false,
    tone: 'danger',
    position: 'top-right',
    circular: false,
    pulse: false,
    label: undefined,
  },
)

defineSlots<{
  /** Елемент, до якого кріпиться значок: кнопка з іконкою, аватар. */
  default?: () => unknown
}>()

type Tone = NonNullable<typeof props.tone>
type Position = NonNullable<typeof props.position>

/*
 * Текст на значку — токен, що контрастує із заливкою В ОБОХ темах.
 * `accent-contrast`/`danger-contrast` білі завжди, а `success`/`warning`/
 * `ink` у темній темі світлішають — білий на них би не читався. Для них
 * текст — колір тла сторінки (`text-main`): темний у темній темі, світлий
 * у світлій, тобто протилежний заливці завжди.
 */
const TONES: Record<Tone, string> = {
  danger: 'bg-danger-solid text-danger-contrast',
  accent: 'bg-accent-solid text-accent-contrast',
  success: 'bg-success text-main',
  warning: 'bg-warning text-main',
  neutral: 'bg-ink text-main',
}

/*
 * Центр значка ставиться НА кут цілі (translate ±50%), а не всередину:
 * так значок однаково «сідає» на кнопку 32px і на аватар 64px.
 *
 * Для кола кут квадрата лежить за межами фігури, і значок висів би в
 * повітрі. Тому для `circular` точка кріплення зсувається на 14.6%
 * сторони — це r·(1 − 1/√2), тобто рівно точка кола під кутом 45°.
 * Сторони кріплення — окремим набором, а не поверх `top-0`: два класи
 * `top-*` на одному елементі вирішує порядок у згенерованому CSS, а не
 * порядок у шаблоні.
 */
const ANCHORS: Record<Position, { square: string; circle: string; shift: string }> = {
  'top-right': {
    square: 'top-0 right-0',
    circle: 'top-[14.6%] right-[14.6%]',
    shift: 'translate-x-1/2 -translate-y-1/2',
  },
  'top-left': {
    square: 'top-0 left-0',
    circle: 'top-[14.6%] left-[14.6%]',
    shift: '-translate-x-1/2 -translate-y-1/2',
  },
  'bottom-right': {
    square: 'bottom-0 right-0',
    circle: 'bottom-[14.6%] right-[14.6%]',
    shift: 'translate-x-1/2 translate-y-1/2',
  },
  'bottom-left': {
    square: 'bottom-0 left-0',
    circle: 'bottom-[14.6%] left-[14.6%]',
    shift: '-translate-x-1/2 translate-y-1/2',
  },
}

const visible = computed(() => {
  if (props.dot) return true
  if (props.count == null || !Number.isFinite(props.count)) return false
  return props.count > 0 || props.showZero
})

const text = computed(() => {
  if (props.dot || props.count == null) return ''
  const max = Number.isFinite(props.max) && props.max > 0 ? Math.floor(props.max) : 99
  return props.count > max ? `${max}+` : String(Math.max(0, Math.floor(props.count)))
})

const badgeClass = computed(() => [
  'pointer-events-none absolute z-10 flex items-center justify-center rounded-full font-semibold leading-none tabular-nums ring-2 ring-card',
  TONES[props.tone],
  ANCHORS[props.position][props.circular ? 'circle' : 'square'],
  ANCHORS[props.position].shift,
  // Число — пігулка, що росте вшир від кола 18px; крапка — 10px.
  props.dot ? 'h-2.5 w-2.5' : 'h-[1.125rem] min-w-[1.125rem] px-1 text-[0.6875rem]',
])
</script>

<template>
  <span class="relative inline-flex shrink-0 align-middle">
    <slot />

    <Transition
      enter-active-class="transition-[opacity,scale] duration-(--duration-base) ease-out"
      enter-from-class="scale-50 opacity-0"
      leave-active-class="transition-[opacity,scale] duration-(--duration-fast) ease-in"
      leave-to-class="scale-50 opacity-0"
    >
      <span v-if="visible" :class="badgeClass" :aria-hidden="label ? undefined : 'true'">
        <!-- Хвиля — окремий шар під значком: animate-ping масштабує елемент,
             і на самому значку з числом «пливли» б цифри. -->
        <span
          v-if="pulse"
          class="absolute inset-0 animate-ping rounded-full opacity-60"
          :class="TONES[tone]"
          aria-hidden="true"
        />
        <span v-if="!dot" class="relative" aria-hidden="true">{{ text }}</span>
        <span v-if="label" class="sr-only">{{ label }}</span>
      </span>
    </Transition>
  </span>
</template>
