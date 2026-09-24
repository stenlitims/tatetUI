<script setup lang="ts">
import { shallowRef } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiSpinner from '~/components/ui/UiSpinner.vue'

const refreshing = shallowRef(false)

function refresh() {
  refreshing.value = true
  setTimeout(() => (refreshing.value = false), 1600)
}
</script>

<template>
  <div class="flex w-full max-w-md flex-col gap-6">
    <div class="flex items-center gap-5">
      <UiSpinner size="xs" tone="accent" />
      <UiSpinner size="sm" tone="accent" />
      <UiSpinner size="md" tone="accent" />
      <UiSpinner size="lg" tone="accent" />
      <UiSpinner size="md" tone="muted" label="Синхронізація" show-label />
    </div>

    <!-- Спінер у рядку списку: колір береться з тексту батька. -->
    <div class="flex items-center justify-between rounded-card border border-line bg-card px-4 py-3">
      <div class="min-w-0">
        <p class="text-sm font-medium text-ink">Замовлення за вересень</p>
        <p class="text-xs text-muted">Оновлено щойно</p>
      </div>
      <UiButton variant="outline" size="sm" :disabled="refreshing" @click="refresh">
        <template #leading>
          <UiSpinner v-if="refreshing" size="xs" />
          <svg v-else class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
          </svg>
        </template>
        {{ refreshing ? 'Оновлюємо…' : 'Оновити' }}
      </UiButton>
    </div>

    <!-- Панель, що вантажиться: aria-busy на контейнері, назва — на спінері. -->
    <div class="flex h-28 items-center justify-center rounded-card border border-dashed border-line-strong bg-subtle" aria-busy="true">
      <UiSpinner size="lg" tone="accent" label="Завантаження звіту" show-label />
    </div>
  </div>
</template>
