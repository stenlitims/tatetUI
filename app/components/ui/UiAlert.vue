<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Смисловий тон: палітра, стандартна іконка й терміновість. */
    tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral'
    /** Заголовок — коротке твердження: «Сесію завершено». */
    title?: string
    /** Показує хрестик. Компонент САМ не ховається — лише повідомляє. */
    dismissible?: boolean
  }>(),
  { tone: 'info', title: '', dismissible: false },
)

const emit = defineEmits<{
  /** Натиснуто хрестик. Ховає повідомлення батьківський стан. */
  dismiss: []
}>()

defineSlots<{
  /** Текст повідомлення. */
  default?: () => unknown
  /** Замінює стандартну іконку тону. */
  icon?: () => unknown
  /** Кнопки дій під текстом. */
  actions?: () => unknown
}>()

const tones: Record<NonNullable<typeof props.tone>, { shell: string; icon: string }> = {
  info: { shell: 'border-info-line bg-info-bg', icon: 'text-info' },
  success: { shell: 'border-success-line bg-success-bg', icon: 'text-success' },
  warning: { shell: 'border-warning-line bg-warning-bg', icon: 'text-warning' },
  danger: { shell: 'border-danger-line bg-danger-bg', icon: 'text-danger' },
  neutral: { shell: 'border-neutral-line bg-neutral-bg', icon: 'text-neutral' },
}

// Негайний сигнал: role="alert" перебиває читання, для решти тонів
// повідомлення — звичайний вміст, який скрінрідер зачине в потоці.
const role = computed(() => (props.tone === 'danger' ? 'alert' : undefined))
</script>

<template>
  <div :role="role" class="flex gap-3 rounded-card border p-3 sm:p-4" :class="tones[tone].shell">
    <slot name="icon">
      <svg
        class="mt-0.5 h-4.5 w-4.5 shrink-0"
        :class="tones[tone].icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <template v-if="tone === 'success'">
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.5 2.5 2.5 5-5" />
        </template>
        <template v-else-if="tone === 'warning'">
          <path d="M12 3 2.5 20h19L12 3z" />
          <path d="M12 9v5" />
          <path d="M12 17h.01" />
        </template>
        <template v-else-if="tone === 'danger'">
          <circle cx="12" cy="12" r="9" />
          <path d="M15 9l-6 6" />
          <path d="M9 9l6 6" />
        </template>
        <template v-else>
          <!-- info та neutral -->
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 8h.01" />
        </template>
      </svg>
    </slot>

    <div class="min-w-0 flex-1 text-sm">
      <p v-if="title" class="font-semibold text-ink">{{ title }}</p>
      <div :class="title ? 'mt-1 text-muted' : 'text-ink'">
        <slot />
      </div>
      <div v-if="$slots.actions" class="mt-2.5 flex flex-wrap gap-2">
        <slot name="actions" />
      </div>
    </div>

    <button
      v-if="dismissible"
      type="button"
      aria-label="Закрити"
      class="-m-1 shrink-0 self-start rounded-control p-1 text-muted transition-colors hover:bg-ink/5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      @click="emit('dismiss')"
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</template>