<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'

const props = withDefaults(
  defineProps<{
    /**
     * Чи показано панель. Не `v-model`: видимість — похідний стан (є
     * обрані рядки, є незбережені зміни), і закриває панель батько,
     * прибравши причину, а не компонент сам.
     */
    open: boolean
    /**
     * Скільки записів обрано. Друкується пігулкою ліворуч і потрапляє в
     * оголошення для скрінрідера. Без нього панель — просто рядок дій.
     */
    count?: number | null
    /**
     * Текст ліворуч: «Незбережені зміни», «обрано». Коли задано `count`,
     * стоїть одразу після числа.
     */
    label?: string
    /**
     * `sticky` — панель живе у потоці документа одразу після списку й
     * прилипає до низу екрана, поки список видно. Tab доходить до неї
     * відразу після рядків. `fixed` — панель телепортується в `<body>` і
     * висить над усім застосунком; тоді фокус переносьте методом `focus()`.
     */
    placement?: 'sticky' | 'fixed'
    /**
     * Хрестик праворуч. Подія `dismiss` — «скасувати вибір» чи «відкинути
     * зміни», залежно від того, що панель показує.
     */
    dismissible?: boolean
    /** Доступна назва панелі-регіону. */
    ariaLabel?: string
  }>(),
  {
    count: null,
    label: undefined,
    placement: 'sticky',
    dismissible: true,
    ariaLabel: 'Дії з обраними',
  },
)

const emit = defineEmits<{
  /** Хрестик або Escape усередині панелі. */
  dismiss: []
}>()

defineSlots<{
  /**
   * Кнопки дій. У панелі від 36rem завширшки — праворуч в один ряд, у
   * вужчій — окремим рядком під лічильником; на телефоні цей рядок не
   * переноситься, а гортається вбік.
   */
  default?: () => unknown
  /** Власний вміст лівої частини замість лічильника й `label`. */
  summary?: (props: { count: number | null }) => unknown
}>()

const barEl = ref<HTMLElement | null>(null)
const teleportReady = shallowRef(false)

onMounted(() => {
  teleportReady.value = true
})

const hasCount = computed(() => typeof props.count === 'number' && Number.isFinite(props.count))

// Число без підпису двозначне («3» — чого?), тож біля лічильника завжди є слово.
const summaryLabel = computed(() => props.label ?? (hasCount.value ? 'обрано' : ''))

/*
 * Оголошення — окремий завжди змонтований live-регіон, а не role="status"
 * на самій панелі: регіон, що з'являється разом зі своїм текстом,
 * скрінрідери здебільшого пропускають. Він має існувати ДО зміни.
 */
const announcement = computed(() => {
  if (!props.open) return ''
  // Те саме, що видно: «3 обрано». Число й підпис читаються одним рядком.
  return hasCount.value ? `${props.count} ${summaryLabel.value}` : summaryLabel.value
})

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !props.dismissible) return
  // Escape усередині панелі не має закривати ще й модалку за нею.
  event.stopPropagation()
  emit('dismiss')
}

/*
 * Chromium на Tab докручує смугу дій лише до кнопки, схованої повністю, і
 * то по центру; частково видиму лишає обрізаною разом із фокус-кільцем.
 * `nearest` разом зі scroll-padding смуги показує кнопку цілою. Лише для
 * фокуса з клавіатури: прокрутка посеред кліку чи тапу зсунула б кнопку
 * з-під пальця.
 */
function onActionsFocusin(event: FocusEvent) {
  const target = event.target as HTMLElement
  if (target.matches(':focus-visible')) target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

/*
 * Корінь — сам липкий елемент, а не обгортка навколо нього: sticky липне
 * лише в межах батька, і обгортка заввишки з панель не дала б їй
 * прилипнути взагалі. Коли панель закрита, корінь порожній і має нульову
 * висоту — місця в розкладці не займає.
 *
 * У `fixed` корінь лишається в потоці порожнім якорем: у ньому живе
 * live-регіон, а сама панель телепортується в <body>.
 *
 * w-full — бо смуга всередині є контейнером запитів, а контейнер ширину
 * з вмісту не бере. У батьку, що підганяє дітей під вміст (flex-col
 * items-center, grid place-items-center), панель без неї схлопувалась
 * до 25px рамки й полів.
 */
const rootClass = computed(() => (props.placement === 'sticky' ? 'sticky bottom-0 z-40 w-full' : ''))

const shellClass = computed(() =>
  props.placement === 'fixed'
    ? 'fixed inset-x-0 bottom-0 z-40 px-3'
    : 'px-1 pt-3',
)

defineExpose({
  /**
   * Переносить фокус на першу дію панелі. Потрібен для `fixed`: телепорт
   * ставить панель у кінець документа, і Tab до неї інакше довгий.
   */
  focus: () => {
    const first = barEl.value?.querySelector<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    ;(first ?? barEl.value)?.focus()
  },
})
</script>

<template>
  <div :class="rootClass">
    <span class="sr-only" role="status" aria-live="polite">{{ announcement }}</span>

    <Teleport to="body" :disabled="placement !== 'fixed' || !teleportReady">
      <Transition
        enter-active-class="transition-[opacity,translate] duration-(--duration-base) ease-out"
        enter-from-class="translate-y-3 opacity-0"
        leave-active-class="transition-[opacity,translate] duration-(--duration-fast) ease-in"
        leave-to-class="translate-y-3 opacity-0"
      >
        <!-- Смуга пропускає кліки крізь себе: на всю ширину вона не має
             перекривати сторінку по боках від самої панелі.

             Вона ж — контейнер для запитів @xl: розкладку обирає ширина,
             яку панелі дали, а не ширина екрана. Липка панель здебільшого
             живе в дравері чи бічній панелі, набагато вужчій за вікно, і
             медіазапит `sm:` ставив її в один ряд там, де місця вже не було. -->
        <div
          v-if="open"
          class="@container pointer-events-none flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          :class="shellClass"
        >
          <!-- Дві розкладки, межа — 36rem ширини контейнера:
               - вужча: лічильник і хрестик угорі, дії — окремим рядком на
                 всю ширину під ними. Раніше лічильник мав основу 0 і
                 стискався першим: п'ять кнопок різали підпис до «запи…», а
                 на телефоні кнопки ставали стовпчиком, хрестик — окремим
                 рядком унизу;
               - ширша: один ряд. Лічильник не стискається — заради нього
                 панель і читають; дії, що не вмістилися, переносяться
                 всередині своєї групи.
               Порядок Tab від ширини не залежить: дії, потім хрестик. -->
          <div
            ref="barEl"
            role="region"
            :aria-label="ariaLabel"
            tabindex="-1"
            class="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 rounded-overlay border border-line bg-card/95 py-2 pl-3 pr-2 shadow-overlay outline-none backdrop-blur-md sm:pl-4 @xl:flex-nowrap"
            @keydown="onKeydown"
          >
            <div class="flex min-w-0 flex-1 items-center gap-2.5 @xl:shrink-0 @xl:basis-auto">
              <slot name="summary" :count="hasCount ? count! : null">
                <span
                  v-if="hasCount"
                  class="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-accent-solid px-2 text-xs font-semibold tabular-nums text-accent-contrast"
                  aria-hidden="true"
                >
                  {{ count }}
                </span>
                <span v-if="summaryLabel" class="truncate text-sm font-medium text-ink">{{ summaryLabel }}</span>
              </slot>
            </div>

            <!-- Без дій обгортки немає зовсім: у вузькій розкладці вона
                 займає власний рядок, і порожня лишала б під лічильником
                 зайвий проміжок.

                 Зовнішній вузол — місце групи в розкладці; min-w-0 дає смузі
                 всередині стиснутися, а не розпирати панель. Внутрішній —
                 сама смуга: на телефоні вона не переноситься, а гортається
                 вбік — один ряд, а не кілька. overflow-x-auto обрізає й
                 по вертикалі, тому -m-1.5 p-1.5 дають місце фокус-кільцю
                 (4px) і невидимій зоні дотику 45px навколо h-9-кнопки, а
                 scroll-px-1.5 — той самий відступ, коли фокус докручує
                 кнопку (onActionsFocusin). justify-end тут не можна: те,
                 що вилізло б за початковий край, прокруткою вже не дістати. -->
            <div v-if="$slots.default" class="order-last min-w-0 basis-full @xl:order-none @xl:basis-auto">
              <div
                class="scrollbar-none -m-1.5 flex flex-wrap items-center gap-1.5 overscroll-x-contain p-1.5 scroll-px-1.5 max-md:flex-nowrap max-md:overflow-x-auto max-md:*:shrink-0"
                @focusin="onActionsFocusin"
              >
                <slot />
              </div>
            </div>

            <button
              v-if="dismissible"
              type="button"
              class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:h-12 pointer-coarse:after:w-12 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"
              aria-label="Закрити панель"
              @click="emit('dismiss')"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
