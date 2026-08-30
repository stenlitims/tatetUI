<script setup lang="ts">
import { ref } from 'vue'
import UiInlineEdit from '~/components/ui/UiInlineEdit.vue'

const author = ref('Ігор Шевченко')
const views = ref<number | null>(1284)
</script>

<template>
  <div class="grid max-w-md items-center gap-1 text-sm sm:grid-cols-[8rem_1fr] sm:gap-3">
    <span class="text-xs text-muted">Автор</span>
    <UiInlineEdit v-model="author" type="text" aria-label="Автор" />
    <span class="text-xs text-muted">Перегляди</span>
    <UiInlineEdit v-model="views" type="number" aria-label="Перегляди" />
  </div>
</template>