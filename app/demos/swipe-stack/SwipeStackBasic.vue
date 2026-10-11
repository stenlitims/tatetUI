<script setup lang="ts">
import { computed, ref } from 'vue'

const threads = [
  { id: 1, title: 'Дизайн', preview: 'Нові макети вже в теці' },
  { id: 2, title: 'Продукт · запуск', preview: 'Домовились на четвер' },
  { id: 3, title: 'Підтримка', preview: 'Клієнт підтвердив виправлення' },
]
const openId = ref<number | null>(null)
const current = computed(() => threads.find((thread) => thread.id === openId.value) ?? null)
</script>

<template>
  <UiSwipeStack
    :open="openId !== null"
    class="h-96 w-full max-w-sm rounded-overlay border border-line"
    base-class="bg-card"
    page-class="bg-main"
    @back="openId = null"
  >
    <template #base>
      <header class="flex h-12 shrink-0 items-center border-b border-line px-4 font-semibold text-ink">Розмови</header>
      <ul class="min-h-0 flex-1 overflow-y-auto">
        <li v-for="thread in threads" :key="thread.id">
          <button
            type="button"
            class="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-hover active:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            @click="openId = thread.id"
          >
            <span class="font-medium text-ink">{{ thread.title }}</span>
            <span class="text-sm text-muted">{{ thread.preview }}</span>
          </button>
        </li>
      </ul>
    </template>
    <template #page>
      <header class="flex h-12 shrink-0 items-center gap-1 border-b border-line bg-card px-2">
        <UiButton variant="ghost" size="icon" label="Назад" @click="openId = null">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </UiButton>
        <span class="truncate font-semibold text-ink">{{ current?.title }}</span>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-muted">
        <p>{{ current?.preview }}.</p>
        <p class="mt-3">На дотиковому екрані потягніть цей екран праворуч — під ним видно список, і відпущений далі 40% ширини екран повертає назад.</p>
      </div>
    </template>
  </UiSwipeStack>
</template>
