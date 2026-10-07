<script setup lang="ts">
/*
 * `separator-style="line"`: між панелями лише лінія 1px — так розділяють
 * список і переписку в месенджерах. Зона захоплення лишається 12px.
 */
</script>

<template>
  <div class="h-64 overflow-hidden rounded-overlay border border-line">
    <UiResizablePanels :min="25" :max="60" separator-style="line">
      <template #start>
        <div class="h-full bg-card p-4">
          <p class="font-semibold text-ink">Чати</p>
          <p class="mt-2 text-sm text-muted">Лінія замість смуги: наведіть курсор, щоб побачити ручку.</p>
        </div>
      </template>
      <template #end>
        <div class="h-full bg-subtle p-4">
          <p class="font-semibold text-ink">Переписка</p>
        </div>
      </template>
    </UiResizablePanels>
  </div>
</template>
