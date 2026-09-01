<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import { useToast, type ToastType } from '~/composables/useToast'

/**
 * Контейнер тостів. Монтується РІВНО ОДИН раз на застосунок — зазвичай у
 * app.vue. Пропсів не має навмисно: усе керування йде через useToast().
 */

defineSlots<Record<string, never>>()

const { toasts, dismiss, pause, resume } = useToast()
const teleportReady = shallowRef(false)

onMounted(() => {
  teleportReady.value = true
})

/*
 * Тон бере ті самі токени статусів, що й UiChip. Вихідна версія малювала
 * тости чистими bg-green-500 / bg-amber-500 з білим текстом — на жовтому
 * це давало контраст ≈1.9:1, тобто попередження було найгірше читабельним
 * саме тоді, коли його найважливіше прочитати.
 *
 * Іконка тону — не декор: колір як єдиний носій значення не читається ні
 * дальтоніком, ні в скрінрідері (там тип чути лише через role), а форма
 * читається всіма.
 */
const TONES: Record<ToastType, { shell: string; icon: string }> = {
  success: { shell: 'bg-success-bg border-success-line text-success', icon: 'text-success' },
  error: { shell: 'bg-danger-bg border-danger-line text-danger', icon: 'text-danger' },
  warning: { shell: 'bg-warning-bg border-warning-line text-warning', icon: 'text-warning' },
  info: { shell: 'bg-info-bg border-info-line text-info', icon: 'text-info' },
}

/*
 * Пауза, поки на тості курсор або фокус. Без неї тост із кнопкою
 * «Скасувати» зникав би саме тоді, коли до неї ведуть курсор. focusout
 * з relatedTarget усередині тоста — це перехід між його кнопками, не вихід.
 */
function onFocusOut(id: number, event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (next && (event.currentTarget as HTMLElement).contains(next)) return
  resume(id)
}

/*
 * Змахування. На телефоні хрестик 16px — не мета для пальця, а тост
 * закривають саме там, де він заважає. Жест — угору (тости зверху) або
 * вбік; рух униз гаситься опором, бо туди зникати нема куди.
 *
 * Поріг 48px: менше — випадковий дотик під час прокрутки, і тост
 * повертається на місце.
 */
const SWIPE_THRESHOLD = 48
const drag = ref<{ id: number; x: number; y: number } | null>(null)
let origin = { x: 0, y: 0 }

function onPointerDown(id: number, event: PointerEvent) {
  if (event.button !== 0) return
  // Кнопки всередині тоста — це кліки, а не початок жесту.
  if ((event.target as HTMLElement).closest('button')) return
  origin = { x: event.clientX, y: event.clientY }
  drag.value = { id, x: 0, y: 0 }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!drag.value) return
  const dx = event.clientX - origin.x
  const dy = event.clientY - origin.y
  // Домінантна вісь, щоб тост не «плавав» по діагоналі.
  if (Math.abs(dx) > Math.abs(dy)) drag.value = { ...drag.value, x: dx, y: 0 }
  else drag.value = { ...drag.value, x: 0, y: dy > 0 ? dy * 0.2 : dy }
}

function onPointerUp() {
  if (!drag.value) return
  const { id, x, y } = drag.value
  drag.value = null
  if (Math.abs(x) >= SWIPE_THRESHOLD || -y >= SWIPE_THRESHOLD) dismiss(id)
}

function dragStyle(id: number) {
  if (drag.value?.id !== id) return undefined
  const { x, y } = drag.value
  const distance = Math.max(Math.abs(x), Math.abs(y))
  return {
    transform: `translate(${x}px, ${y}px)`,
    opacity: String(Math.max(0.3, 1 - distance / 160)),
    transition: 'none',
  }
}
</script>

<template>
  <Teleport to="body" :disabled="!teleportReady">
    <!--
      data-overlay-ignore — маркер для useFocusTrap: без нього тости, що
      з'явилися під відкритою модалкою, отримали б inert разом з рештою
      фону, і кнопку «Закрити» на них не можна було б натиснути.

      top-[4.75rem] до md: на мобільних зверху зазвичай висить шапка
      застосунку, і на top-4 тости накривали б кнопку меню.
    -->
    <div
      data-overlay-ignore
      class="pointer-events-none fixed top-[4.75rem] left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2 md:top-4"
      role="region"
      aria-label="Сповіщення"
    >
      <TransitionGroup name="ui-toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto w-[calc(100vw-2rem)] max-w-sm touch-none rounded-card border p-3 shadow-raised backdrop-blur-sm transition-[transform,opacity]"
          :class="TONES[toast.type].shell"
          :style="dragStyle(toast.id)"
          :role="toast.type === 'error' ? 'alert' : 'status'"
          :aria-live="toast.type === 'error' ? 'assertive' : 'polite'"
          @mouseenter="pause(toast.id)"
          @mouseleave="resume(toast.id)"
          @focusin="pause(toast.id)"
          @focusout="onFocusOut(toast.id, $event)"
          @pointerdown="onPointerDown(toast.id, $event)"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <div class="flex items-start gap-3">
            <svg
              class="mt-0.5 h-4.5 w-4.5 shrink-0"
              :class="TONES[toast.type].icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <template v-if="toast.type === 'success'">
                <circle cx="12" cy="12" r="9" />
                <path d="m8.5 12.5 2.5 2.5 5-5" />
              </template>
              <template v-else-if="toast.type === 'warning'">
                <path d="M12 3 2.5 20h19L12 3z" />
                <path d="M12 9v5" />
                <path d="M12 17h.01" />
              </template>
              <template v-else-if="toast.type === 'error'">
                <circle cx="12" cy="12" r="9" />
                <path d="M15 9l-6 6" />
                <path d="M9 9l6 6" />
              </template>
              <template v-else>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5" />
                <path d="M12 8h.01" />
              </template>
            </svg>

            <div class="min-w-0 flex-1">
              <p v-if="toast.title" class="mb-0.5 font-semibold text-ink">{{ toast.title }}</p>
              <p class="text-sm break-words" :class="toast.title ? 'text-ink' : ''">{{ toast.message }}</p>
              <!--
                Дії приходять ДАНИМИ з useToast({ actions: [...] }), а не
                слотом: черга живе в composable поза шаблоном, слот туди
                не прокинути. Кнопки малює контейнер у стилі ghost-UiButton
                (споживач задає лише label і onClick). Клік по дії сам тост
                НЕ закриває — закривайте через dismiss(id), коли потрібно.
              -->
              <div v-if="toast.actions?.length" class="mt-2 flex gap-2">
                <button
                  v-for="(action, index) in toast.actions"
                  :key="`${toast.id}-${index}`"
                  type="button"
                  class="h-9 rounded-control px-3 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-ink active:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9 md:px-2.5 md:text-xs"
                  @click="action.onClick()"
                >
                  {{ action.label }}
                </button>
              </div>
            </div>
            <button
              type="button"
              class="-m-1 shrink-0 rounded-control p-1 text-muted opacity-70 transition-[opacity,background-color,color] hover:bg-hover hover:text-ink hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              @click="dismiss(toast.id)"
            >
              <span class="sr-only">Закрити сповіщення</span>
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.ui-toast-enter-active {
  transition:
    opacity var(--duration-slow) var(--ease-out),
    transform var(--duration-slow) var(--ease-emphasized);
}

.ui-toast-leave-active {
  transition:
    opacity var(--duration-base) var(--ease-in),
    transform var(--duration-base) var(--ease-in);
}

.ui-toast-enter-from {
  opacity: 0;
  transform: translateY(-0.75rem) scale(0.96);
}

.ui-toast-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem) scale(0.98);
}

/* Без цього решта тостів стрибком займає місце закритого. */
.ui-toast-move {
  transition: transform var(--duration-slow) var(--ease-emphasized);
}

/* leave-active із position:absolute — щоб елемент, що зникає, не тримав
   висоту і сусіди почали рух одразу. */
.ui-toast-leave-active {
  position: absolute;
}

@media (prefers-reduced-motion: reduce) {
  .ui-toast-enter-active,
  .ui-toast-leave-active,
  .ui-toast-move {
    transition-duration: 1ms;
  }

  .ui-toast-enter-from,
  .ui-toast-leave-to {
    transform: none;
  }
}
</style>
