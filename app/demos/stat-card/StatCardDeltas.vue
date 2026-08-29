<script setup lang="ts">
import UiStatCard from '~/components/ui/UiStatCard.vue'
</script>

<template>
  <div class="grid w-full gap-4 sm:grid-cols-3">
    <!-- Зростання доброго — зелене. -->
    <UiStatCard label="Конверсія" value="4,8 %" :delta="0.6" delta-good="up" hint="більше — краще" />

    <!-- Зростання поганого — червоне. Той самий знак, інший колір. -->
    <UiStatCard label="Відтік клієнтів" value="2,1 %" :delta="0.4" delta-good="down" hint="менше — краще" />

    <!-- Метрика без «кращого» напряму: стрілка є, кольору немає. -->
    <UiStatCard label="Частка мобільних" value="63 %" :delta="5" delta-good="none" hint="просто зміна" />

    <UiStatCard label="Завантаження" loading />
  </div>
</template>
