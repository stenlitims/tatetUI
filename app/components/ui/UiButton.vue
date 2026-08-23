<script setup lang="ts">
import { computed, ref } from 'vue'
import { NuxtLink } from '#components'
import UiLoadingDots from './UiLoadingDots.vue'

type Variant = 'solid' | 'soft' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const props = withDefaults(
  defineProps<{
    /** Візуальна вага. `solid` — головна дія на екрані, вона має бути одна. */
    variant?: Variant
    /** Розмір. `icon` і `icon-sm` — квадратні, для кнопок без тексту. */
    size?: Size
    /** Блокує кліки й показує індикатор, зберігаючи ширину кнопки. */
    loading?: boolean
    disabled?: boolean
    /**
     * Робить кнопку посиланням: корінь стає `NuxtLink` замість `button`.
     * Потрібно, коли дія веде на іншу сторінку — інакше зникає
     * середній клік, Ctrl+клік і пункт «відкрити в новій вкладці».
     */
    to?: string | Record<string, unknown>
    type?: 'button' | 'submit' | 'reset'
    /**
     * Доступна назва. ОБОВ'ЯЗКОВИЙ для кнопок без тексту — інакше кнопка
     * для скрінрідера безіменна.
     */
    label?: string
    /** Розтягує кнопку на всю ширину контейнера. */
    block?: boolean
    title?: string
  }>(),
  { variant: 'solid', size: 'md', type: 'button' },
)

const emit = defineEmits<{
  /** Не спрацьовує, поки кнопка `disabled` або `loading`. */
  click: [event: MouseEvent]
}>()

defineSlots<{
  /** Вміст кнопки — зазвичай текст. */
  default?: () => unknown
  /** Іконка перед текстом. */
  leading?: () => unknown
  /** Іконка після тексту. */
  trailing?: () => unknown
}>()

/**
 * `accent-solid`, а не `primary-600`: заливка й акцентний текст — різні
 * токени, бо той самий відтінок не може бути водночас читабельним текстом
 * і достатньо контрастною заливкою під білим.
 *
 * `active:` тут не декоративний. Preflight Tailwind скидає
 * -webkit-tap-highlight-color у прозорий, а :hover на дотику не настає
 * взагалі — без явного стану натискання кнопка на телефоні не дає ЖОДНОГО
 * відгуку, і користувач тисне вдруге, бо не зрозумів, чи спрацювало.
 */
const variants: Record<Variant, string> = {
  solid:
    'bg-accent-solid text-accent-contrast hover:bg-accent-solid-hover active:bg-accent-solid-hover shadow-card',
  soft: 'bg-primary-50 text-accent hover:bg-primary-100 active:bg-primary-100 border border-primary-200',
  outline: 'border border-line bg-card text-ink hover:bg-hover active:bg-hover',
  ghost: 'text-muted hover:text-ink hover:bg-hover active:bg-hover active:text-ink',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-110 shadow-card',
}

/**
 * Спершу мобільні розміри, далі `md:` повертає десктопні.
 *
 * На дотику всі варіанти зводяться до `h-12` (45px за кореневого 15px) —
 * це мінімум, з якого палець перестає промахуватися; `h-11` дало б 41px.
 * Ієрархія розмірів на мобільному лишається в паддінгу та шрифті, бо різна
 * ВИСОТА кнопок пальцю нічого не дає, а нижче 44px просто ламає влучність.
 */
const sizes: Record<Size, string> = {
  sm: 'h-12 px-3 text-sm gap-1.5 md:h-8 md:px-2.5 md:text-xs',
  md: 'h-12 px-4 text-base gap-2 md:h-9 md:px-3.5 md:text-sm',
  lg: 'h-12 px-5 text-base gap-2 md:h-11',
  icon: 'h-12 w-12 justify-center md:h-9 md:w-9',
  'icon-sm': 'h-12 w-12 justify-center text-sm md:h-7 md:w-7 md:text-xs',
}

const isDisabled = computed(() => props.disabled || props.loading)

const classes = computed(() => [
  'relative inline-flex items-center rounded-control font-medium transition-colors select-none',
  // Видиме фокус-кільце. У всіх чотирьох вихідних проєктах focus:outline-none
  // стоїть майже всюди без заміни — керування з клавіатури стає сліпим.
  // ring-offset відриває кільце від заливки, інакше на solid-кнопці воно
  // зливається з фоном самої кнопки.
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset',
  variants[props.variant],
  sizes[props.size],
  props.block ? 'w-full justify-center' : '',
  isDisabled.value ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
])

/**
 * Компонент, а НЕ рядок 'NuxtLink'. Рядок у `<component :is>`
 * резолвиться лише проти глобально зареєстрованих компонентів; інакше Vue
 * рендерить літеральний тег <nuxtlink> і посилання мертве.
 */
const rootTag = computed(() => (props.to ? NuxtLink : 'button'))

function onClick(event: MouseEvent) {
  if (isDisabled.value) return
  emit('click', event)
}

const root = ref<HTMLElement | null>(null)

// Шаблонний ref на компонент дає інстанс, а не DOM-елемент, тож `.focus()`
// на ньому не працює. Діалогам підтвердження треба ставити фокус на кнопку
// програмно, тому метод експонується явно.
defineExpose({
  /** Ставить фокус на кнопку. Використовує ConfirmDialog. */
  focus: () => {
    const el = root.value as HTMLElement & { $el?: HTMLElement }
    ;(el?.$el ?? el)?.focus?.()
  },
})
</script>

<template>
  <component
    :is="rootTag"
    ref="root"
    :to="to"
    :type="to ? undefined : type"
    :class="classes"
    :disabled="to ? undefined : isDisabled"
    :aria-disabled="to && isDisabled ? 'true' : undefined"
    :aria-label="label"
    :aria-busy="loading || undefined"
    :title="title"
    @click="onClick"
  >
    <!-- Індикатор позиційований абсолютно, а вміст лише гасне до opacity-0:
         так кнопка не змінює ширину посеред запиту і сусідні елементи не
         стрибають. -->
    <span v-if="loading" class="absolute inset-0 flex items-center justify-center">
      <UiLoadingDots />
    </span>

    <span class="inline-flex items-center gap-[inherit]" :class="{ 'opacity-0': loading }">
      <slot name="leading" />
      <slot />
      <slot name="trailing" />
    </span>
  </component>
</template>
