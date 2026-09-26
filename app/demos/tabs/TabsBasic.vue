<script setup lang="ts">
import { ref } from 'vue'
import UiTabs from '~/components/ui/UiTabs.vue'

const last = ref('—')
</script>

<template>
  <div class="flex min-w-0 flex-col gap-6">
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

    <div class="rounded-card border border-line bg-card p-3">
      <UiTabs
        size="sm"
        aria-label="Секції картки"
        :tabs="[
          { id: 'meta', label: 'Мета' },
          { id: 'files', label: 'Файли' },
          { id: 'activity', label: 'Активність' },
        ]"
      >
        <template #panel-meta><p class="text-sm text-muted">Метадані запису.</p></template>
        <template #panel-files><p class="text-sm text-muted">Прикріплені файли.</p></template>
        <template #panel-activity><p class="text-sm text-muted">Історія змін.</p></template>
      </UiTabs>
    </div>

    <p class="text-xs text-muted">Остання зміна: {{ last }}</p>
  </div>
</template>