<script setup lang="ts">
import { ref } from 'vue'
import UiChip from '~/components/ui/UiChip.vue'

const filters = ref(['Київ', 'Опубліковано', 'Цього тижня'])
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <UiChip tone="neutral">чернетка</UiChip>
      <UiChip tone="accent">на розгляді</UiChip>
      <UiChip tone="success" dot label="Опубліковано">опубліковано</UiChip>
      <UiChip tone="warning">потребує уваги</UiChip>
      <UiChip tone="danger">помилка</UiChip>
      <UiChip tone="info" size="sm">інформація</UiChip>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <UiChip
        v-for="filter in filters"
        :key="filter"
        tone="accent"
        size="sm"
        removable
        @remove="filters = filters.filter((item) => item !== filter)"
      >
        {{ filter }}
      </UiChip>
      <UiChip v-if="!filters.length" tone="neutral" size="sm" clickable @click="filters = ['Київ', 'Опубліковано', 'Цього тижня']">
        повернути фільтри
      </UiChip>
    </div>
  </div>
</template>
