<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiMenu from '~/components/ui/UiMenu.vue'

const last = ref('—')

const items = [
  { label: 'Перейменувати', action: 'rename' },
  { label: 'Дублювати', action: 'duplicate' },
  { label: 'Експортувати', action: 'export' },
]
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <UiMenu width="12rem" placement="bottom-end">
      <template #trigger="{ toggle, isOpen, triggerAttrs }">
        <UiButton v-bind="triggerAttrs" variant="outline" @click="toggle">
          Дії {{ isOpen ? '▴' : '▾' }}
        </UiButton>
      </template>

      <template #content="{ toggle }">
        <button
          v-for="item in items"
          :key="item.action"
          type="button"
          role="menuitem"
          class="flex w-full items-center px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-hover focus:outline-none focus-visible:bg-hover md:py-2"
          @click="last = item.label; toggle()"
        >
          {{ item.label }}
        </button>
        <div role="separator" class="my-1 h-px bg-line" />
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center px-3 py-2.5 text-left text-sm text-danger transition-colors hover:bg-danger-bg focus:outline-none focus-visible:bg-danger-bg md:py-2"
          @click="last = 'Видалити'; toggle()"
        >
          Видалити
        </button>
      </template>
    </UiMenu>

    <p class="text-sm text-muted">Обрано: {{ last }}</p>
  </div>
</template>
