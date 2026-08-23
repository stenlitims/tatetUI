<script setup lang="ts">
import { useToast, type ToastType } from '~/composables/useToast'

/**
 * Контейнер тостів. Монтується РІВНО ОДИН раз на застосунок — зазвичай у
 * app.vue. Пропсів не має навмисно: усе керування йде через useToast().
 */

defineSlots<Record<string, never>>()

const { toasts, dismiss } = useToast()

/*
 * Тон бере ті самі токени статусів, що й UiChip. Вихідна версія малювала
 * тости чистими bg-green-500 / bg-amber-500 з білим текстом — на жовтому
 * це давало контраст ≈1.9:1, тобто попередження було найгірше читабельним
 * саме тоді, коли його найважливіше прочитати.
 */
const TONES: Record<ToastType, string> = {
  success: 'bg-success-bg border-success-line text-success',
  error: 'bg-danger-bg border-danger-line text-danger',
  warning: 'bg-warning-bg border-warning-line text-warning',
  info: 'bg-info-bg border-info-line text-info',
}
</script>

<template>
  <Teleport to="body">
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
          class="pointer-events-auto w-[calc(100vw-2rem)] max-w-sm rounded-card border p-3 shadow-raised"
          :class="TONES[toast.type]"
          :role="toast.type === 'error' ? 'alert' : 'status'"
          :aria-live="toast.type === 'error' ? 'assertive' : 'polite'"
        >
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <p v-if="toast.title" class="mb-0.5 font-semibold">{{ toast.title }}</p>
              <p class="text-sm break-words">{{ toast.message }}</p>
            </div>
            <button
              type="button"
              class="-m-1 shrink-0 rounded-control p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
.ui-toast-enter-active,
.ui-toast-leave-active {
  transition:
    opacity 300ms ease,
    transform 300ms ease;
}

.ui-toast-enter-from,
.ui-toast-leave-to {
  opacity: 0;
  transform: translateY(-0.75rem);
}

/* Без цього решта тостів стрибком займає місце закритого. */
.ui-toast-move {
  transition: transform 300ms ease;
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
}
</style>
