<script setup lang="ts">
import UiExpand from '~/components/ui/UiExpand.vue'

const issues = [
  'Уточніть матеріал товарів у правилах добірки.',
  'Перед схваленням перевірте схожі сторінки.',
  'Додайте опис секції українською та російською мовами.',
]
</script>

<template>
  <UiExpand title="Зауваження до пропозиції" size="sm" tone="warning">
    <template #trailing>
      <span class="rounded-control bg-card px-1.5 py-0.5 text-xs tabular-nums">{{ issues.length }}</span>
    </template>
    <ul class="space-y-2">
      <li v-for="issue in issues" :key="issue" class="rounded-control bg-warning-bg p-3 text-xs text-warning">
        {{ issue }}
      </li>
    </ul>
  </UiExpand>
</template>
