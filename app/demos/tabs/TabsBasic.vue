<script setup lang="ts">
import { ref } from 'vue'
import UiTabs from '~/components/ui/UiTabs.vue'

const last = ref('—')
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiTabs
      aria-label="Вигляд"
      :tabs="[
        { id: 'overview', label: 'Огляд' },
        { id: 'settings', label: 'Налаштування' },
        { id: 'logs', label: 'Журнал' },
        { id: 'archived', label: 'Архів', disabled: true },
      ]"
      @change="last = $event"
    >
      <template #panel-overview><p class="text-sm text-muted">Загальні показники об'єкта.</p></template>
      <template #panel-settings><p class="text-sm text-muted">Форми налаштувань.</p></template>
      <template #panel-logs><p class="text-sm text-muted">Події та помилки.</p></template>
    </UiTabs>

    <UiTabs
      variant="pills"
      aria-label="Щільність"
      :tabs="[
        { id: 'compact', label: 'Стисло' },
        { id: 'cozy', label: 'Вільно' },
      ]"
    >
      <template #panel-compact><p class="text-sm text-muted">Щільний список.</p></template>
      <template #panel-cozy><p class="text-sm text-muted">Список із повітрям.</p></template>
    </UiTabs>

    <p class="text-xs text-muted">Остання зміна: {{ last }}</p>
  </div>
</template>