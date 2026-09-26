<script setup lang="ts">
import UiMenu from '~/components/ui/UiMenu.vue'
import { useTheme, type ThemePreference } from '~/composables/useTheme'

const { isDark, preference, setPreference } = useTheme()

/*
 * Три стани, а не два. Перемикач «світла ↔ темна» назавжди фіксує вибір
 * у localStorage, і користувач, який просто хотів подивитися, як виглядає
 * інша тема, потім не розуміє, чому сайт не слідує за системною темою
 * вночі. «Як у системі» повертає це слідування явно.
 */
const options: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Світла' },
  { value: 'dark', label: 'Темна' },
  { value: 'system', label: 'Як у системі' },
]

function choose(value: ThemePreference, event: MouseEvent, close: () => void) {
  close()
  // Центр кола розкриття — точка кліку. Клавіатурний вибір (clientX = 0)
  // розкривається від кнопки в шапці, а не з кута екрана.
  const origin =
    event.clientX || event.clientY
      ? { x: event.clientX, y: event.clientY }
      : { x: window.innerWidth - 40, y: 28 }
  setPreference(value, origin)
}
</script>

<template>
  <UiMenu placement="bottom-end" width="11rem" aria-label="Тема оформлення">
    <template #trigger="{ toggle, triggerAttrs }">
      <button
        type="button"
        v-bind="triggerAttrs"
        class="relative flex h-9 w-9 items-center justify-center rounded-control border border-line text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:h-12 pointer-coarse:after:w-12 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"
        aria-label="Тема оформлення"
        @click="toggle"
      >
        <!-- ClientOnly навколо іконки, а не кнопки: сама кнопка має бути в
             прередереному HTML, щоб шапка не стрибала після гідрації. Іконка ж
             залежить від теми, яку сервер не знає. -->
        <ClientOnly>
          <svg v-if="isDark" class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2" />
            <path
              d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linejoin="round"
            />
          </svg>
          <template #fallback>
            <span class="h-4 w-4" />
          </template>
        </ClientOnly>
      </button>
    </template>

    <template #content="{ toggle }">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="menuitemradio"
        :aria-checked="preference === option.value"
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-hover focus:outline-none focus-visible:bg-hover"
        :class="preference === option.value ? 'text-ink' : 'text-muted'"
        @click="choose(option.value, $event, toggle)"
      >
        <span class="flex h-4 w-4 items-center justify-center" aria-hidden="true">
          <svg
            v-if="preference === option.value"
            class="h-3.5 w-3.5 text-accent"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M20 6 9 17l-5-5"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        {{ option.label }}
      </button>
    </template>
  </UiMenu>
</template>
