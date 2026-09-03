<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useAttrs,
  useId,
  useSlots,
  watch,
} from 'vue'
import { useOverlayLayer } from '~/composables/useOverlayStack'
import { useScrollLock } from '~/composables/useScrollLock'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { useReducedMotion } from '~/composables/useReducedMotion'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Відкрито. Використовуйте через `v-model`. */
    modelValue?: boolean
    /** Заголовок. Ігнорується, якщо задано слот `header`. */
    title?: string
    /** Ширина панелі. */
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
    /** Додаткові класи панелі — коли готових розмірів не вистачає. */
    panelClass?: string
    /**
     * Стабільний id шару в стеку оверлеїв. Задавати не обов'язково:
     * без нього генерується автоматично.
     */
    modalId?: string
    /** Показувати хрестик і дозволяти закриття через Escape. */
    closable?: boolean
    /**
     * Клік по затемненому фону закриває вікно.
     *
     * Типово `true` — на відміну від UiDrawer, де типово `false`.
     * Модалка зазвичай інформаційна, і випадкове закриття нічого не коштує;
     * drawer майже завжди містить форму, де це втрата введеного.
     */
    closeOnBackdrop?: boolean
    /** Ні Escape, ні клік по фону не закривають — лише явна дія. */
    persistent?: boolean
    /** Прибрати внутрішні відступи вмісту. */
    noPadding?: boolean
    /**
     * CSS-селектор усередині панелі, якому віддати фокус при відкритті.
     *
     * Типово фокус отримує сама панель, а НЕ перший інпут: на мобільних
     * автофокус в інпуті одразу піднімає клавіатуру і з'їдає пів екрана.
     */
    initialFocus?: string
    /**
     * Доступне ім'я діалогу, коли слот `header` не є заголовком.
     *
     * Без нього aria-labelledby вказує на контейнер слота, і якщо там
     * лежить поле вводу — ім'я вікна обчислюється з його ЗНАЧЕННЯ. Діалог
     * пошуку оголошувався як «Діалог: тек» на слові «текст».
     */
    ariaLabel?: string
  }>(),
  {
    modelValue: false,
    title: '',
    size: 'lg',
    panelClass: '',
    closable: true,
    closeOnBackdrop: true,
    persistent: false,
    noPadding: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

defineSlots<{
  /** Вміст вікна. */
  default?: () => unknown
  /** Замінює заголовок цілком. Тоді `title` не використовується. */
  header?: () => unknown
  /** Кнопки дій. Футер не рендериться, якщо слот порожній. */
  footer?: () => unknown
}>()

const attrs = useAttrs()
const slots = useSlots()

const generatedId = useId()
const titleId = `${generatedId}-title`

const backdropEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)

// class обробляємо окремо через :class, решту атрибутів прокидаємо на корінь.
const wrapperAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

const hasCustomHeader = computed(() => !!slots.header)
const hasHeader = computed(() => hasCustomHeader.value || !!props.title || props.closable)
const hasAccessibleHeader = computed(() => hasCustomHeader.value || !!props.title)
const teleportReady = shallowRef(false)

const SIZE_CLASSES: Record<NonNullable<typeof props.size>, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-[96rem]',
}

// Без футера нижній відступ контенту має враховувати home indicator на iOS.
const contentPaddingClass = computed(() => {
  if (props.noPadding) return ''
  return slots.footer ? 'p-4 sm:p-5' : 'p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5'
})

const layer = useOverlayLayer(props.modalId)
const scrollLock = useScrollLock()
const focusTrap = useFocusTrap(() => panelEl.value)
const prefersReducedMotion = useReducedMotion()

// Тривалість задана явно, бо transition-и висять на ДІТЯХ — Vue не може
// вивести її з кореневого елемента. Без useReducedMotion панель чекала б
// повні 200 мс у DOM навіть із вимкненими анімаціями.
const transitionDuration = computed(() =>
  prefersReducedMotion.value ? 0 : { enter: 260, leave: 200 },
)

function closeModal() {
  emit('update:modelValue', false)
  emit('close')
}

type CloseReason = 'button' | 'escape' | 'backdrop'

function requestClose(reason: CloseReason) {
  if (!props.closable) return
  if (reason !== 'button' && props.persistent) return
  if (reason === 'backdrop' && !props.closeOnBackdrop) return
  closeModal()
}

/*
 * Клік по фону рахуємо лише тоді, коли на фоні почалося І закінчилося
 * натискання. Інакше виділення тексту зсередини панелі з відпусканням
 * мишки над фоном закриває вікно разом із незбереженою формою — класичний
 * спосіб втратити заповнену форму одним рухом.
 */
let pressedOnBackdrop = false

function onRootPointerDown(event: PointerEvent) {
  pressedOnBackdrop = event.target === backdropEl.value
}

function onRootClick(event: MouseEvent) {
  if (!pressedOnBackdrop) return
  pressedOnBackdrop = false
  if (event.target !== backdropEl.value) return
  requestClose('backdrop')
}

async function handleOpen() {
  layer.activate()
  scrollLock.lock()
  await nextTick()
  focusTrap.activate({ initialFocus: props.initialFocus ?? null })
}

function handleClose() {
  focusTrap.deactivate()
  scrollLock.unlock()
  // Шар знімаємо одразу (щоб Escape коректно дістався наступного оверлея),
  // а z-index лишається зафіксованим до кінця анімації виходу.
  layer.deactivate()
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) void handleOpen()
    else handleClose()
  },
)

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // isTopmost — щоб Escape закривав ЛИШЕ верхній оверлей, а не всі відкриті.
  if (!props.modelValue || !layer.isTopmost.value) return
  if (props.persistent || !props.closable) return
  event.stopPropagation()
  requestClose('escape')
}

onMounted(() => {
  teleportReady.value = true
  document.addEventListener('keydown', onKeyDown)
  if (props.modelValue) void handleOpen()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
  // Компонент могли знищити відкритим (навігація) — handleClose знімає і
  // лок прокрутки, і пастку фокуса, і шар зі стеку.
  handleClose()
})
</script>

<template>
  <Teleport to="body" :disabled="!teleportReady">
    <Transition name="ui-modal" :duration="transitionDuration" @after-leave="layer.settle()">
      <div
        v-if="modelValue"
        data-ui-overlay
        class="ui-modal fixed inset-0 flex items-end justify-center sm:items-center sm:p-4"
        :class="attrs.class"
        :style="{ zIndex: layer.zIndex.value }"
        v-bind="wrapperAttrs"
        @pointerdown="onRootPointerDown"
        @click="onRootClick"
      >
        <div ref="backdropEl" class="ui-modal-backdrop absolute inset-0 bg-backdrop/50 backdrop-blur-sm" />

        <!-- Знизу до sm — bottom sheet, вище — центроване вікно. Це не
             декор: на телефоні центроване вікно з клавіатурою не вміщається. -->
        <div
          ref="panelEl"
          class="ui-modal-panel relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-overlay border border-line bg-card shadow-overlay outline-none sm:max-h-[85dvh] sm:rounded-overlay"
          :class="[SIZE_CLASSES[size], panelClass]"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          :aria-labelledby="!ariaLabel && hasAccessibleHeader ? titleId : undefined"
          :aria-label="ariaLabel || (hasAccessibleHeader ? undefined : 'Діалогове вікно')"
        >
          <div
            v-if="hasHeader"
            class="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-subtle px-4 py-3 sm:px-5"
          >
            <div
              :id="hasAccessibleHeader ? titleId : undefined"
              class="flex min-w-0 flex-1 items-center gap-3"
            >
              <slot name="header">
                <h3 class="m-0 truncate text-lg font-semibold tracking-tight text-ink">
                  {{ title }}
                </h3>
              </slot>
            </div>
            <!--
              Хрестик лишається дрібним (h-8 = 30px) — це вторинна дія в
              шапці, збільшувати заливку означало б сперечатися з назвою
              вікна. Тому точність дотику тримає невидима зона 45×45 через
              `pointer-coarse:after:` — той самий патерн, що в UiButton і
              UiSwitch. Без неї на телефоні єдина кнопка закриття була
              нижчою за мінімальну ціль у 44px (W3C 2.5.8 Target Size).
              `relative` тут не декор: без нього `::after` рахував би
              зміщення від шапки, а не від кнопки.
            -->
            <button
              v-if="closable"
              type="button"
              class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-line bg-card text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:h-12 pointer-coarse:after:w-12 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"
              aria-label="Закрити"
              @click="requestClose('button')"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>

          <div
            class="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
            :class="contentPaddingClass"
          >
            <slot />
          </div>

          <div
            v-if="$slots.footer"
            class="flex shrink-0 flex-wrap justify-end gap-3 border-t border-line bg-subtle px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-4"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/*
 * Анімація ОДНІЄЮ <Transition> на корені, а не вкладеними.
 *
 * У вихідному коді внутрішній <Transition name="fade"> обгортав панель БЕЗ
 * v-if, тож не спрацьовував ніколи, а половина стилів була мертвим кодом:
 * реально було видно лише opacity-фейд усього блоку.
 *
 * Тривалість задана явно через :duration у шаблоні, бо самі transition-и
 * висять на ДІТЯХ — з кореневого елемента Vue вивести її не може.
 */

.ui-modal-enter-active .ui-modal-backdrop,
.ui-modal-leave-active .ui-modal-backdrop {
  transition: opacity 200ms ease;
}

.ui-modal-enter-from .ui-modal-backdrop,
.ui-modal-leave-to .ui-modal-backdrop {
  opacity: 0;
}

.ui-modal-enter-active .ui-modal-panel {
  transition:
    opacity 260ms ease,
    transform 260ms cubic-bezier(0.32, 0.72, 0, 1);
}

.ui-modal-leave-active .ui-modal-panel {
  transition:
    opacity 200ms ease,
    transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

/* Мобільні: панель — bottom sheet, тож виїжджає знизу. */
.ui-modal-enter-from .ui-modal-panel,
.ui-modal-leave-to .ui-modal-panel {
  opacity: 0;
  transform: translateY(100%);
}

@media (min-width: 640px) {
  .ui-modal-enter-from .ui-modal-panel,
  .ui-modal-leave-to .ui-modal-panel {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-modal-enter-active .ui-modal-backdrop,
  .ui-modal-leave-active .ui-modal-backdrop,
  .ui-modal-enter-active .ui-modal-panel,
  .ui-modal-leave-active .ui-modal-panel {
    transition-duration: 1ms;
  }

  .ui-modal-enter-from .ui-modal-panel,
  .ui-modal-leave-to .ui-modal-panel {
    transform: none;
  }
}
</style>
