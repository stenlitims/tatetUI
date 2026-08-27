<script setup lang="ts">
import UiBreadcrumb from '~/components/ui/UiBreadcrumb.vue'

// Посилання — лише на реальні маршрути сайту: прередер доглядає href'и
// у демо, і вигаданий маршрут дає 404 на збиранні.
const items = [
  { label: 'Документація', to: '/docs' },
  { label: 'Компоненти', to: '/docs/components/button' },
  { label: 'Breadcrumb' },
]
</script>

<template>
  <UiBreadcrumb :items="items" />
</template>