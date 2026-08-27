<script setup lang="ts">
import UiChip from '~/components/ui/UiChip.vue'
import UiMultiSelect from '~/components/ui/UiMultiSelect.vue'
import type { MultiSelectOption } from '~/components/ui/UiMultiSelect.vue'

const options: MultiSelectOption[] = [
  { value: 'admin', label: 'Адміністратор' },
  { value: 'editor', label: 'Редактор' },
  { value: 'smm', label: 'SMM' },
  { value: 'viewer', label: 'Спостерігач' },
  { value: 'billing', label: 'Білінг' },
  { value: 'api', label: 'API-доступ' },
]

const selected = ref<string[]>(['editor'])
</script>

<template>
  <div class="max-w-sm">
    <UiMultiSelect v-model="selected" :options="options" label="Ролі користувача" />
    <p class="mt-2 text-xs text-muted">Обрано: {{ selected.join(', ') || '—' }}</p>
  </div>
</template>