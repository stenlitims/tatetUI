<script setup lang="ts">
import { ref } from 'vue'
import UiPagination from '~/components/ui/UiPagination.vue'

const page = ref(3)
const pageSize = ref(20)
const totalPages = ref(22)
const totalItems = ref(437)
</script>

<template>
  <div class="flex flex-col gap-4">
    <UiPagination
      v-model:page="page"
      v-model:page-size="pageSize"
      :total-pages="totalPages"
      :total-items="totalItems"
      :page-size-options="[10, 20, 50]"
    />
    <p class="text-xs text-muted">
      Сторінка {{ page }} із {{ totalPages }}, розмір {{ pageSize }}.
    </p>
  </div>
</template>