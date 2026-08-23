<script setup lang="ts">
import UiButton from '~/components/ui/UiButton.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'
</script>

<template>
  <div class="w-full max-w-md rounded-card border border-line bg-card">
    <UiEmptyState
      title="Поки що жодного проєкту"
      description="Проєкт збирає сторінки, файли та доступи в одному місці."
      tone="accent"
    >
      <template #icon>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          />
        </svg>
      </template>

      <UiButton size="sm">Створити проєкт</UiButton>
    </UiEmptyState>
  </div>
</template>
