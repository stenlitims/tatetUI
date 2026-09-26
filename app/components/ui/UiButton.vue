<script setup lang="ts">
import { computed, ref } from 'vue'
import { NuxtLink } from '#components'
import UiLoadingDots from './UiLoadingDots.vue'

const props = withDefaults(
  defineProps<{
    /**
     * Візуальна вага. `solid` — головна дія на екрані, вона має бути одна.
     * `link` — виглядає як посилання в тексті, але лишається кнопкою:
     * «Показати ще», «Скинути фільтри» посеред абзацу чи підвалу картки.
     */
    variant?: 'solid' | 'soft' | 'outline' | 'ghost' | 'danger' | 'link'
    /**
     * Висота кнопки. На мобільному ієрархія лишається: `sm` 9, `md` 10,
     * `lg` 12 (у rem за кореня 15px), а точність дотику тримає невидима
     * зона 44×44 (`pointer-coarse:`, див. нижче). `icon` і `icon-sm` —
     * квадратні, для кнопок без тексту.
     */
    size?: 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'
    /** Блокує кліки й показує індикатор, зберігаючи ширину кнопки. */
    loading?: boolean
    /** Блокує кліки. На відміну від `loading`, не показує індикатора. */
    disabled?: boolean
    /**
     * Робить кнопку посиланням: корінь стає `NuxtLink` замість `button`.
     * Потрібно, коли дія веде на іншу сторінку — інакше зникає
     * середній клік, Ctrl+клік і пункт «відкрити в новій вкладці».
     */
    to?: string | Record<string, unknown>
    /** Тип нативної кнопки. Ігнорується, коли задано `to`. */
    type?: 'button' | 'submit' | 'reset'
    /**
     * Доступна назва. ОБОВ'ЯЗКОВИЙ для кнопок без тексту — інакше кнопка
     * для скрінрідера безіменна.
     */
    label?: string
    /** Розтягує кнопку на всю ширину контейнера. */
    block?: boolean
    /** Нативна підказка при наведенні. Не замінює `label` для скрінрідера. */
    title?: string
  }>(),
  { variant: 'solid', size: 'md', type: 'button' },
)

/**
 * Аліаси виводяться З типу props, а не оголошуються окремо перед ним.
 *
 * Це не стилістика. nuxt-component-meta друкує в таблиці API те, що
 * бачить у defineProps: якщо там стоїть посилання на аліас, у колонку
 * «Тип» потрапляє слово «Variant», а не перелік значень — тобто саме те,
 * заради чого читач і відкрив таблицю. Інлайновий union розкривається
 * повністю (перевірено на /api/component-meta/UiButton).
 */
type Variant = NonNullable<typeof props.variant>
type Size = NonNullable<typeof props.size>

/*
 * JSDoc на подіях nuxt-component-meta НЕ витягує — на відміну від props і
 * слотів, поле description для events повертається порожнім за будь-якого
 * синтаксису (перевірено і кортежний `click: [e]`, і call-signature
 * `(e: 'click'): void`). Тому опис подій у таблиці API береться з
 * frontmatter сторінки, а наявність цього коментаря стереже check-docs,
 * читаючи сам SFC. У редакторі підказка все одно працює.
 */
const emit = defineEmits<{
  /** Клік по кнопці. Не спрацьовує, поки вона `disabled` або `loading`. */
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
  outline: 'border border-line bg-card text-ink hover:border-line-strong hover:bg-hover active:bg-hover',
  ghost: 'text-muted hover:text-ink hover:bg-hover active:bg-hover active:text-ink',
  danger:
    'bg-danger-solid text-danger-contrast hover:bg-danger-solid-hover active:bg-danger-solid-hover shadow-card',
  link: 'h-auto px-0 text-accent underline-offset-4 hover:underline active:opacity-80',
}

/*
 * Мобільний масштаб — ієрархічний, а не «всі однакові».
 *
 * Раніше всі розміри зводилися до h-12 (45px): `sm`-кнопка була фізично
 * більшою за десктопний `lg`, ієрархія зникала, а рядок дрібних дій у
 * панелі списку займав п'ять рядів по висоті. Тепер на дотику `sm` 9,
 * `md` 10, `lg` 12 (rem за кореня 15px) — ієрархія і щільність лишилися,
 * а точність дотику тримає НЕ висота, а невидима зона 44×44 через
 * `pointer-coarse:after:` (той самий патерн, що в UiSwitch).
 *
 * `sm` на мобільному теж тримає `text-base` — той самий, що в полі поруч,
 * щоб текст дрібних дій не був дрібнішим за введений. `md:` повертає
 * щільні розміри.
 */
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-base gap-1.5 md:h-8 md:px-2.5 md:text-xs',
  md: 'h-10 px-4 text-base gap-2 md:h-9 md:px-3.5 md:text-sm',
  lg: 'h-12 px-5 text-base gap-2 md:h-11',
  icon: 'h-10 w-10 justify-center md:h-9 md:w-9',
  'icon-sm': 'h-9 w-9 justify-center text-base md:h-7 md:w-7 md:text-xs',
}

/*
 * link не має власної висоти й паддінгу — розмір дає лише шрифт. Окрема
 * таблиця, а не «перекрити» класи з `sizes`: `px-0` поверх `px-4`
 * вирішувався порядком у ЗГЕНЕРОВАНОМУ CSS, а Tailwind ставить `.px-0`
 * раніше за `.px-3/.px-4/.px-5` (і `active:scale-100` раніше за
 * `active:scale-[0.98]`). Перекриття мовчки програвало: посилання посеред
 * абзацу мало 11–19px полів з боків і стискалося при натисканні.
 */
const linkSizes: Record<Size, string> = {
  sm: 'text-base gap-1.5 md:text-xs',
  md: 'text-base gap-2 md:text-sm',
  lg: 'text-base gap-2',
  icon: 'justify-center',
  'icon-sm': 'justify-center text-base md:text-xs',
}

/*
 * Невидима зона дотику 45×45 навколо дрібних кнопок.
 *
 * Точність дотику вимірюється по цільовій зоні, а не по заливці (W3C
 * 2.5.8 Target Size). Самі цілі нижче 44px (h-9 = 33.75px), тому на
 * пристрої з грубим основним вказівником — телефон, планшет без
 * стилуса — `::after` добудовує зону до 45×45 (h-12 за кореня 15px) навколо центру кнопки. Той самий патерн, що в UiSwitch,
 * лише утилітами Tailwind v4 (`pointer-coarse:` = медіазапит
 * `(pointer: coarse)`), без власного CSS у компоненті.
 *
 * На стилус-пристроях (primary pointer: fine) зони немає — і не треба:
 * прицілювання там точне. Сусідні іконкові кнопки з `gap-1.5` можуть
 * торкатися зонами по краях — це штатна ситуація (Material 48dp теж
 * торкаються), клік у смужці перекриття бере кнопка, ближча до точки
 * дотику в DOM-порядку.
 */
const touchTargetClass =
  'pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 ' +
  'pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 ' +
  "pointer-coarse:after:content-[''] pointer-coarse:after:h-12 pointer-coarse:after:w-12"

const isDisabled = computed(() => props.disabled || props.loading)
const isLink = computed(() => props.variant === 'link')

const classes = computed(() => [
  // Перелік властивостей явний: `transition` (all) анімував би ще й width під
  // час зміни тексту, і кнопка «пливла» б. Тривалість — типова з токенів.
  // whitespace-nowrap: висота кнопки фіксована (h-10), і підпис, що
  // переносився у вузькому ряду на телефоні, виходив за заливку другим
  // рядком («Завантажити / дані» поверх сусіднього рядка).
  'relative inline-flex items-center whitespace-nowrap rounded-control font-medium transition-[color,background-color,border-color,box-shadow,transform,opacity] select-none',
  // Масштаб натискання — лише в кнопок з поверхнею: у link стискати нема
  // чого, і текст посеред абзацу «підстрибував» би.
  isLink.value ? '' : 'active:scale-[0.98]',
  touchTargetClass,
  // Видиме фокус-кільце. У всіх чотирьох вихідних проєктах focus:outline-none
  // стоїть майже всюди без заміни — керування з клавіатури стає сліпим.
  // ring-offset відриває кільце від заливки, інакше на solid-кнопці воно
  // зливається з фоном самої кнопки.
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset',
  variants[props.variant],
  isLink.value ? linkSizes[props.size] : sizes[props.size],
  props.block ? 'w-full justify-center' : '',
  isDisabled.value ? 'opacity-50 cursor-not-allowed' : '',
])

/**
 * Компонент, а НЕ рядок 'NuxtLink'. Рядок у `<component :is>`
 * резолвиться лише проти глобально зареєстрованих компонентів; інакше Vue
 * рендерить літеральний тег <nuxtlink> і посилання мертве.
 */
const rootTag = computed(() => (props.to ? NuxtLink : 'button'))

function onClick(event: MouseEvent) {
  if (isDisabled.value) {
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }
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
    :tabindex="to && isDisabled ? -1 : undefined"
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
