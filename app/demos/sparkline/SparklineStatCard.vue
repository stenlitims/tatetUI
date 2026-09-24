<script setup lang="ts">
import UiSparkline from '~/components/ui/UiSparkline.vue'
import UiStatCard from '~/components/ui/UiStatCard.vue'
</script>

<template>
  <div class="grid w-full gap-4 sm:grid-cols-3">
    <UiStatCard label="Виторг" value="₴1,28 млн" value-label="1 284 300 гривень" :delta="12.4" hint="проти серпня">
      <template #trend>
        <UiSparkline :data="[42, 48, 45, 53, 51, 60, 58, 66, 71, 78, 84]" variant="area" tone="success" />
      </template>
    </UiStatCard>
    <UiStatCard label="Відтік" value="3,6 %" :delta="0.4" delta-good="down" hint="проти серпня">
      <template #trend>
        <UiSparkline :data="[2.1, 2.4, 2.2, 2.9, 3.1, 2.8, 3.4, 3.6]" tone="danger" />
      </template>
    </UiStatCard>
    <UiStatCard label="Нові клієнти" value="87" :delta="-4" delta-format="absolute" hint="проти серпня">
      <template #trend>
        <UiSparkline :data="[14, 9, 12, 16, 11, 13, 12]" variant="bar" tone="neutral" />
      </template>
    </UiStatCard>
  </div>
</template>
