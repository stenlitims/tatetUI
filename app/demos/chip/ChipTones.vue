<script setup lang="ts">
import UiChip from '~/components/ui/UiChip.vue'
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UiChip tone="neutral">чернетка</UiChip>
    <UiChip tone="accent">на розгляді</UiChip>
    <UiChip tone="success" dot label="Опубліковано">опубліковано</UiChip>
    <UiChip tone="warning">потребує уваги</UiChip>
    <UiChip tone="danger">помилка</UiChip>
    <UiChip tone="info" size="sm">інформація</UiChip>
  </div>
</template>
