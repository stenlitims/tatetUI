<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiTable, { type TableHeader } from '~/components/ui/UiTable.vue'

const headers: TableHeader[] = [
  { value: 'name', text: 'Назва', width: 200, flex: true },
  { value: 'size', text: 'Розмір', align: 'right', width: 120 },
]

const loading = ref(true)
const items = ref<Record<string, unknown>[]>([])

function loadData() {
  loading.value = true
  items.value = []
  setTimeout(() => {
    items.value = [
      { id: 1, name: 'report.pdf', size: '2.4 МБ' },
      { id: 2, name: 'logo.svg', size: '14 КБ' },
    ]
    loading.value = false
  }, 1200)
}

function loadEmpty() {
  loading.value = true
  items.value = []
  setTimeout(() => (loading.value = false), 900)
}
</script>

<template>
  <div class="w-full space-y-3">
    <div class="flex gap-2">
      <UiButton size="sm" @click="loadData">Завантажити дані</UiButton>
      <UiButton size="sm" variant="outline" @click="loadEmpty">Порожній результат</UiButton>
    </div>
    <UiTable :headers="headers" :items="items" :loading="loading" empty-text="Файлів не знайдено" />
  </div>
</template>
