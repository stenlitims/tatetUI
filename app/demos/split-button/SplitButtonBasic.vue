<script setup lang="ts">
import { ref } from 'vue'
import UiSplitButton, { type SplitButtonItem } from '~/components/ui/UiSplitButton.vue'

const last = ref('—')

const items: SplitButtonItem[] = [
  { id: 'draft', label: 'Зберегти як чернетку', description: 'Не буде видно клієнту' },
  { id: 'template', label: 'Зберегти як шаблон' },
  { id: 'copy', label: 'Зберегти й дублювати' },
  { id: 'discard', label: 'Скасувати зміни', danger: true },
]
</script>

<template>
  <div class="flex flex-col items-start gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <UiSplitButton
        label="Зберегти"
        :items="items"
        menu-width="16rem"
        @click="last = 'Зберегти'"
        @select="last = $event.label"
      />
      <UiSplitButton
        label="Експорт"
        variant="outline"
        :items="[{ id: 'csv', label: 'CSV' }, { id: 'xlsx', label: 'XLSX' }]"
        @click="last = 'Експорт'"
        @select="last = `Експорт → ${$event.label}`"
      />
      <!-- Альтернатив немає — каретка вимкнена, головна дія працює. -->
      <UiSplitButton label="Надіслати" variant="soft" menu-disabled @click="last = 'Надіслати'" />
    </div>

    <p class="text-sm text-muted">Остання дія: <span class="text-ink">{{ last }}</span></p>
  </div>
</template>
