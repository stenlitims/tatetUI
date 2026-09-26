<script setup lang="ts">
import { computed, ref, watch } from 'vue'

export interface StepItem {
  id: string
  label: string
  description?: string
  disabled?: boolean
  /**
   * Явний стан поверх позиції кроку. `complete` — пройдений (галочка) навіть
   * попереду поточного, для нелінійних майстрів; `error` — на кроці є
   * помилка, яку треба виправити, і це видно без відкриття кроку.
   */
  status?: 'complete' | 'error'
}

type StepState = 'done' | 'active' | 'upcoming'

const props = withDefaults(
  defineProps<{
    /** Кроки майстра. */
    steps: StepItem[]
    /** Поточний крок (0-based). Використовуйте через `v-model`. */
    modelValue?: number
    /**
     * Режим кліків. `any` — клік по будь-якому кроку; `visited` — лише по
     * вже пройдених (і на крок вперед); `none` — клікати не можна, тільки
     * Next/Back у споживача, і кроки рендеряться не кнопками, а текстом.
     */
    clickMode?: 'any' | 'visited' | 'none'
    /** Ховати заголовки — лишаються тільки кружечки-індикатори. */
    compact?: boolean
    /**
     * Напрям. `vertical` ставить кроки стовпчиком — для бокової панелі
     * майстра і вузьких екранів, де горизонтальний ряд переносився б.
     */
    orientation?: 'horizontal' | 'vertical'
    /**
     * Доступна назва навігації по кроках. Задавайте власну, якщо на
     * сторінці кілька степперів: однакові орієнтири не розрізнити.
     */
    ariaLabel?: string
  }>(),
  { modelValue: 0, clickMode: 'visited', compact: false, orientation: 'horizontal', ariaLabel: 'Кроки' },
)

const emit = defineEmits<{
  'update:modelValue': [step: number]
  /** Активний крок змінився. */
  change: [step: number]
}>()

defineSlots<{
  /** Власний рендер індикатора кроку: число, галочка, іконка. */
  indicator?: (props: {
    step: StepItem
    index: number
    state: 'done' | 'active' | 'upcoming'
    error: boolean
  }) => unknown
  /** Власний рендер заголовка кроку. */
  label?: (props: { step: StepItem; state: 'done' | 'active' | 'upcoming'; error: boolean }) => unknown
}>()

const currentIndex = computed(() =>
  Math.min(
    Math.max(0, Number.isFinite(props.modelValue) ? Math.floor(props.modelValue) : 0),
    Math.max(0, props.steps.length - 1),
  ),
)

const vertical = computed(() => props.orientation === 'vertical')
const interactive = computed(() => props.clickMode !== 'none')
// visited і none — лінійний майстер: кроки проходять по черзі.
const linear = computed(() => props.clickMode !== 'any')

/*
 * Найдальший крок, до якого дійшли. У лінійному майстрі все до нього вже
 * пройдено, навіть якщо користувач повернувся назад: раніше повернення з
 * третього кроку на перший стирало галочки другого й третього, а сам
 * третій ставав недоступним — усе доводилось проходити заново. Щоб почати
 * майстер спочатку, змініть `:key` компонента.
 */
const reached = ref(currentIndex.value)
watch(currentIndex, (value) => {
  if (value > reached.value) reached.value = value
})
const furthest = computed(() => Math.min(reached.value, Math.max(0, props.steps.length - 1)))

const hasError = (index: number) => props.steps[index]?.status === 'error'

const stateOf = (index: number): StepState => {
  if (index === currentIndex.value) return 'active'
  const step = props.steps[index]
  if (step?.status === 'complete') return 'done'
  return index < currentIndex.value || (linear.value && index < furthest.value) ? 'done' : 'upcoming'
}

// Лінія до кроку зафарбована, якщо до нього вже дійшли.
const isReached = (index: number) => index <= currentIndex.value || stateOf(index) === 'done'

// У режимі visited дозволено йти по всіх пройдених і на один крок уперед.
const maxReachable = computed(() =>
  Math.min(props.steps.length - 1, Math.max(furthest.value, currentIndex.value + 1)),
)

function isStepDisabled(step: StepItem, index: number) {
  if (step.disabled) return true
  if (props.clickMode === 'none') return index !== currentIndex.value
  return props.clickMode === 'visited' && index > maxReachable.value
}

function onStepClick(index: number) {
  const step = props.steps[index]
  if (!step || isStepDisabled(step, index)) return
  if (index === currentIndex.value) return
  emit('update:modelValue', index)
  emit('change', index)
}

/*
 * Стан кроку для скрінрідера. Галочка — aria-hidden, а номер кроку вона
 * заміщує, тож пройдений крок звучав рівно як майбутній.
 */
function statusText(index: number) {
  if (hasError(index)) return 'помилка'
  return stateOf(index) === 'done' ? 'завершено' : ''
}

/*
 * У режимі none кроки не клікаються — і тому це не кнопки. Вимкнені
 * кнопки з opacity-50 робили пройдений прогрес схожим на «недоступно», а
 * скрінрідер оголошував кожен крок «недоступним».
 */
function stepAttrs(step: StepItem, index: number) {
  const current = index === currentIndex.value ? 'step' : undefined
  if (!interactive.value) return { 'aria-current': current }
  return { type: 'button', disabled: isStepDisabled(step, index), 'aria-current': current }
}

/*
 * Невидима зона дотику: кружечок h-8 (30px) і рядок з підписом нижчі за
 * 44px. Зона щонайменше 45×45 і не вужча за сам крок.
 */
const touchZone =
  "pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-[''] pointer-coarse:after:h-12 pointer-coarse:after:w-[max(100%,3rem)]"

/*
 * Горизонтальний ряд на телефоні.
 *
 * Пункти з лінією — flex-1 з нульовою основою, тож перенестися на новий
 * рядок вони не можуть ніколи: три кроки з підписами на 375px просто
 * виїжджали за край («Публікац…»). Нижче sm підписи лишаються лише в
 * АКТИВНОГО кроку, решта — тільки для скрінрідера (номер і стан кружечка
 * видно й так). Активний підпис обрізається трикрапкою, а не розпирає ряд.
 */
function isCollapsedOnMobile(index: number) {
  return !vertical.value && stateOf(index) !== 'active'
}

function stepClass(step: StepItem, index: number) {
  return [
    'group relative flex items-start gap-2.5 text-left',
    vertical.value ? '' : 'min-w-0',
    interactive.value
      ? [
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset',
          touchZone,
          isStepDisabled(step, index) ? 'cursor-not-allowed' : '',
        ]
      : '',
    // Приглушуємо лише справді вимкнені кроки. Недосяжний у visited крок і
    // так «майбутній» (muted) — ще й opacity-50 давала нечитабельний текст.
    step.disabled ? 'opacity-50' : '',
  ]
}

function indicatorClass(index: number) {
  const state = stateOf(index)
  const base =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-[color,background-color,border-color,box-shadow]'
  if (hasError(index)) {
    return [base, 'border-danger bg-danger-bg text-danger', state === 'active' ? 'ring-4 ring-danger/15' : '']
  }
  return [
    base,
    // Активний крок — з «ореолом»: серед кількох однакових кружечків саме
    // він має читатись першим, а не лише за кольором межі.
    state === 'done'
      ? 'border-accent-solid bg-accent-solid text-accent-contrast'
      : state === 'active'
        ? 'border-accent-solid bg-card text-accent ring-4 ring-ring/15'
        : ['border-line bg-card text-muted', interactive.value ? 'group-hover:border-line-strong' : ''],
  ]
}

function labelClass(index: number) {
  if (hasError(index)) return 'text-danger'
  if (stateOf(index) === 'active') return 'text-ink'
  return interactive.value ? 'text-muted group-hover:text-ink' : 'text-muted'
}

function itemClass(index: number) {
  if (vertical.value) return 'relative flex pb-6 last:pb-0'
  // Лінія стоїть ПЕРЕД кроком усередині того ж <li>: росте лише вона,
  // тож пункти з лінією розтягуються, а перший — ні.
  return index > 0 && !props.compact ? 'flex min-w-0 flex-1 items-start' : 'flex items-start'
}
</script>

<template>
  <nav :aria-label="ariaLabel">
    <!-- Список, а не ряд кнопок: скрінрідер повідомляє «список, 4 пункти» і
         позицію кроку в ньому. -->
    <ol :class="vertical ? 'flex flex-col' : 'flex flex-wrap items-start gap-y-3'">
      <li v-for="(step, index) in steps" :key="step.id" :class="itemClass(index)">
        <div
          v-if="!vertical && index > 0"
          class="flex h-8 items-center"
          :class="compact ? 'px-1' : 'min-w-3 flex-1 px-1 sm:min-w-6 sm:px-1.5'"
          aria-hidden="true"
        >
          <!-- У compact лінія має власну ширину: у контейнері без ширини
               w-full рахувалась від нуля, і кружечки стояли без з'єднань. -->
          <span
            class="h-px transition-colors"
            :class="[compact ? 'w-4' : 'w-full', isReached(index) ? 'bg-accent-solid' : 'bg-line']"
          />
        </div>
        <span
          v-if="vertical && index < steps.length - 1"
          aria-hidden="true"
          class="absolute start-4 top-8 bottom-0 w-px -translate-x-1/2 transition-colors"
          :class="isReached(index + 1) ? 'bg-accent-solid' : 'bg-line'"
        />

        <component
          :is="interactive ? 'button' : 'div'"
          v-bind="stepAttrs(step, index)"
          :class="stepClass(step, index)"
          @click="interactive && onStepClick(index)"
        >
          <span :class="indicatorClass(index)">
            <slot name="indicator" :step="step" :index="index" :state="stateOf(index)" :error="hasError(index)">
              <svg v-if="hasError(index)" class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 7v6m0 4h.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
              </svg>
              <svg v-else-if="stateOf(index) === 'done'" class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
              </svg>
              <span v-else>{{ index + 1 }}</span>
            </slot>
          </span>

          <!-- Compact ховає підпис візуально, але не для скрінрідера: інакше
               крок звучав би лише як «1». -->
          <span v-if="!compact" class="min-w-0" :class="isCollapsedOnMobile(index) ? 'max-sm:sr-only' : ''">
            <span class="block text-sm font-medium leading-tight max-sm:truncate" :class="labelClass(index)">
              <slot name="label" :step="step" :state="stateOf(index)" :error="hasError(index)">{{ step.label }}</slot>
            </span>
            <span
              v-if="step.description && stateOf(index) !== 'upcoming'"
              class="mt-0.5 block text-xs text-muted max-sm:truncate"
            >
              {{ step.description }}
            </span>
          </span>
          <span v-else class="sr-only">
            <slot name="label" :step="step" :state="stateOf(index)" :error="hasError(index)">{{ step.label }}</slot>
          </span>
          <span v-if="statusText(index)" class="sr-only">, {{ statusText(index) }}</span>
        </component>
      </li>
    </ol>
  </nav>
</template>
