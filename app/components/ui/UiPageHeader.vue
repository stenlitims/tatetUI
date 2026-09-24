<script setup lang="ts">
import { NuxtLink } from '#components'

const props = withDefaults(
  defineProps<{
    /** Назва сторінки чи розділу. Замінюється слотом `title`. */
    title?: string
    /** Один-два речення під назвою: що тут відбувається або що зробити. */
    description?: string
    /**
     * Рівень заголовка. `h1` — шапка сторінки (одна на сторінку); `h2` —
     * шапка розділу чи панелі всередині неї. Вигляд від рівня не залежить —
     * його задає `size`.
     */
    as?: 'h1' | 'h2' | 'h3'
    /** Кегль назви. Розведено з `as`: семантика і вигляд — різні рішення. */
    size?: 'sm' | 'md' | 'lg'
    /**
     * Маршрут посилання «Назад» над назвою. Посилання, а не `history.back()`:
     * сторінку часто відкривають за прямим посиланням, і «назад» у історії
     * вивів би з застосунку взагалі.
     */
    backTo?: string | Record<string, unknown>
    /** Текст посилання «Назад»: краще конкретний — «До замовлень». */
    backLabel?: string
    /** Межа під шапкою — коли далі одразу йде вміст без власної рамки. */
    divider?: boolean
  }>(),
  {
    title: '',
    description: undefined,
    as: 'h1',
    size: 'md',
    backTo: undefined,
    backLabel: 'Назад',
    divider: false,
  },
)

defineSlots<{
  /** Крихти над назвою — зазвичай `UiBreadcrumb`. Замінює посилання «Назад». */
  breadcrumb?: () => unknown
  /** Аватар, іконка чи логотип ліворуч від назви. */
  leading?: () => unknown
  /** Власний вміст заголовка замість `title`: назва з чипом статусу. */
  title?: () => unknown
  /** Рядок метаданих під назвою: чипи, дати, автор. */
  meta?: () => unknown
  /** Дії сторінки. На мобільному переносяться під назву. */
  actions?: () => unknown
  /** Вміст під шапкою в її межах — найчастіше вкладки розділу. */
  default?: () => unknown
}>()

type Size = NonNullable<typeof props.size>

const TITLE_SIZES: Record<Size, string> = {
  sm: 'text-lg',
  md: 'text-xl sm:text-2xl',
  lg: 'text-2xl sm:text-3xl',
}
</script>

<template>
  <header :class="divider ? 'border-b border-line pb-4 sm:pb-5' : ''">
    <div v-if="$slots.breadcrumb" class="mb-3">
      <slot name="breadcrumb" />
    </div>
    <NuxtLink
      v-else-if="backTo"
      :to="backTo"
      class="group relative mb-3 inline-flex items-center gap-1 rounded-control text-sm text-muted transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:top-1/2 pointer-coarse:after:h-12 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"
    >
      <!-- Посилання — рядок тексту заввишки 20px; на дотику ціль добудовує
           невидима зона 45px через ::after, як у UiButton. -->
      <svg
        class="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      {{ backLabel }}
    </NuxtLink>

    <!--
      Назва й дії — у flex із переносом, а не в сітці з фіксованою колонкою
      дій: коли кнопок три, а назва довга, на планшеті дії переходять під
      назву цілим рядком замість того, щоб стискати заголовок у стовпчик.
    -->
    <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div class="flex min-w-0 flex-1 basis-72 items-start gap-3">
        <div v-if="$slots.leading" class="shrink-0">
          <slot name="leading" />
        </div>
        <div class="min-w-0 flex-1">
          <component
            :is="as"
            class="font-semibold tracking-tight break-words text-ink"
            :class="TITLE_SIZES[size]"
          >
            <slot name="title">{{ title }}</slot>
          </component>
          <p v-if="description" class="mt-1 max-w-3xl text-sm text-muted sm:text-base">
            {{ description }}
          </p>
          <div v-if="$slots.meta" class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
            <slot name="meta" />
          </div>
        </div>
      </div>

      <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </header>
</template>
