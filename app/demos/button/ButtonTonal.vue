<script setup lang="ts">
import UiButton from '~/components/ui/UiButton.vue'
</script>

<!--
  Та сама пара «вторинна + головна» на двох поверхнях: картці й кольоровій
  підкладці. Заливка tonal напівпрозора, тож бере відтінок тла — на
  підкладці вона не стає білою коробкою, як outline з непрозорим bg-card.
-->
<template>
  <div class="grid w-full max-w-md gap-4">
    <div class="rounded-card border border-line bg-card p-5 shadow-card">
      <p class="font-semibold text-ink">Опублікувати чернетку?</p>
      <p class="mt-1 text-sm text-muted">Сторінку побачить уся команда.</p>
      <div class="mt-5 flex justify-end gap-3">
        <UiButton variant="tonal">Скасувати</UiButton>
        <UiButton>Опублікувати</UiButton>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 rounded-card bg-info-bg px-4 py-3">
      <p class="text-sm text-ink">Доступна нова версія.</p>
      <div class="flex gap-2">
        <UiButton variant="tonal" size="sm">Пізніше</UiButton>
        <UiButton size="sm">Оновити</UiButton>
      </div>
    </div>
  </div>
</template>
