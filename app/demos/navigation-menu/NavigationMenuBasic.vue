<script setup lang="ts">
import { shallowRef } from 'vue'

const openItem = shallowRef<string | null>(null)
const selected = shallowRef('Огляд')
const items = [
  { id: 'overview', label: 'Огляд', href: '#overview', current: true },
  {
    id: 'products',
    label: 'Продукти',
    children: [
      { id: 'analytics', label: 'Аналітика', description: 'Звіти й продуктові метрики', href: '#analytics' },
      { id: 'automation', label: 'Автоматизація', description: 'Тригери, дії та сценарії', href: '#automation' },
      { id: 'labs', label: 'Labs', description: 'Експериментальні можливості', disabled: true },
    ],
  },
  { id: 'pricing', label: 'Ціни', href: '#pricing' },
]
</script>

<template>
  <UiNavigationMenu v-model="openItem" :items="items" @select="selected = $event.label" />
  <p class="mt-6 text-sm text-muted">Останній вибір: {{ selected }}</p>
</template>
