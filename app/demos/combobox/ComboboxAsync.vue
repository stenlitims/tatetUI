<script setup lang="ts">
import { ref } from 'vue'
import UiCombobox from '~/components/ui/UiCombobox.vue'
import type { ComboboxOption } from '~/components/ui/UiCombobox.vue'

// Фейковий async-пошук: споживач дебаунить сам, компонент лише емітує search.
const allCities = ['Київ', 'Львів', 'Одеса', 'Харків', 'Дніпро', 'Вінниця', 'Полтава', 'Чернігів']

const options = ref<ComboboxOption[]>([])
const loading = ref(false)
const selected = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

function onSearch(query: string) {
  if (timer) clearTimeout(timer)
  loading.value = true
  timer = setTimeout(() => {
    const needle = query.toLowerCase()
    options.value = allCities
      .filter((city) => city.toLowerCase().includes(needle))
      .map((city) => ({ value: city, label: city }))
    loading.value = false
  }, 400)
}
</script>

<template>
  <div class="max-w-sm">
    <UiCombobox
      v-model="selected"
      :options="options"
      :loading="loading"
      label="Місто"
      placeholder="Почніть набирати…"
      @search="onSearch"
    />
    <p class="mt-2 text-xs text-muted">Обрано: {{ selected || '—' }}</p>
  </div>
</template>