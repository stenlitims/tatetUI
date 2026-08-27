<script setup lang="ts">
import UiAvatar from '~/components/ui/UiAvatar.vue'
import UiChip from '~/components/ui/UiChip.vue'

const people = [
  { name: 'Ігор Шевченко', role: 'Адміністратор' },
  { name: 'Марія Ковалишин', role: 'Редактор' },
  { name: 'Олег Марченко', role: 'Спостерігач' },
  { name: 'Анна Ковальчук', role: 'SMM' },
]
</script>

<template>
  <ul class="divide-y divide-line rounded-card border border-line bg-card">
    <li
      v-for="person in people"
      :key="person.name"
      class="flex items-center gap-3 px-3 py-2.5"
    >
      <UiAvatar :name="person.name" :size="32" />
      <span class="flex-1 truncate text-sm text-ink">{{ person.name }}</span>
      <UiChip tone="neutral">{{ person.role }}</UiChip>
    </li>
  </ul>
</template>