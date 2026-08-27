<script setup lang="ts">
import UiButton from '~/components/ui/UiButton.vue'
import UiCard from '~/components/ui/UiCard.vue'
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <UiCard>
      <template #header>
        <h4 class="text-sm font-semibold text-ink">Сплатити зараз</h4>
      </template>
      <p class="text-sm text-muted">
        Тіло картки: текст, форми, будь-який вміст. Шапка й підвал — опційні.
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UiButton variant="ghost" size="sm">Скасувати</UiButton>
          <UiButton size="sm">Сплатити</UiButton>
        </div>
      </template>
    </UiCard>

    <UiCard hoverable as="article" padding="sm">
      <h4 class="text-sm font-semibold text-ink">Клікабельна картка</h4>
      <p class="mt-1 text-sm text-muted">
        З <code class="text-xs">hoverable</code> — легкий підйом при наведенні.
      </p>
    </UiCard>
  </div>
</template>